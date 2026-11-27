// The spoken conversation, shared by every device: the browser device page, the
// Raspberry Pi with an Atom Echo button, and the phone app.
//
// A device reports one event per turn and gets back an ordered list of actions
// to perform. Devices hold no conversation logic; that lives here.
//
// Events
//   question  the owner held the button and spoke (audio) or typed (text)
//   tap       a short press while nothing was playing: replay the last clips
//   choose    a screen tap on one of the visits offered after "which visit do you mean?" (slug)
//
// Actions, performed in order
//   { type: "speak", text, url }            url streams MP3 from /api/voice/tts, or is null (device speaks text itself)
//   { type: "play", url, start, end, speaker, text, visit }   an excerpt of the original recording (WAV)
//   { type: "listen", expect: "question" | "yes_no" | "choice" }   what the next hold of the button is for;
//       "choice" means the reply names a visit ("the first one", "November 3rd"), spoken like a question
//
// One-button gestures: hold = ask (or answer yes/no); tap = hear the doctor's
// words again. A tap while something is playing should stop playback on the
// device and not reach the server.
import { listVisits, getVisit } from "./store.mjs";
import { listRequests } from "./db.mjs";
import { getHousehold } from "./household.mjs";
import { remember, routeQuestion, pickOption } from "./remember.mjs";
import { transcribeQuestion, medicationHints, TranscriptionUnavailable } from "./transcribe.mjs";
import { rememberTurn, findCachedTurn } from "./voice-cache.mjs";
import { speechUrl, PHRASES } from "./tts.mjs";
import { requestHelp, RequestError } from "./requests.mjs";
import { findItem } from "./review.mjs";

const SESSION_TTL_MS = 30 * 60 * 1000;
// Kept on globalThis so Next.js dev reloads don't drop live sessions.
const sessions = (globalThis.__tandemVoiceSessions ??= new Map());

function getSession(id) {
  const now = Date.now();
  for (const [k, s] of sessions) if (now - s.touchedAt > SESSION_TTL_MS) sessions.delete(k);
  let s = id && sessions.get(id);
  if (!s) {
    s = { id: id || crypto.randomUUID(), last: null, pending: null, touchedAt: now };
    sessions.set(s.id, s);
  }
  s.touchedAt = now;
  return s;
}

/** Plain yes/no from a short spoken reply, or null if it's something else. */
export function classifyYesNo(text) {
  const t = String(text ?? "").toLowerCase().replace(/[^a-z' ]/g, " ").replace(/\s+/g, " ").trim();
  if (/^(yes|yeah|yep|yup|sure|please|ok|okay|go ahead|do it|yes please|that's fine|alright|all right)\b/.test(t)) return "yes";
  if (/^(no|nope|not now|don't|do not|cancel|never mind|nevermind|no thanks|no thank you)\b/.test(t)) return "no";
  return null;
}

const round2 = (x) => Math.round(x * 100) / 100;
// v changes when clip processing changes, so cached copies aren't reused.
const CLIP_VERSION = 3;
const clipUrl = (slug, c) => `/api/audio/${slug}/clip?start=${round2(c.start)}&end=${round2(c.end)}&v=${CLIP_VERSION}`;

/**
 * @param {object} input
 * @param {string} [input.sessionId]
 * @param {"question"|"tap"} input.event
 * @param {string} [input.text]       typed question (skips transcription)
 * @param {Buffer} [input.audio]      recorded question
 * @param {string} [input.mimeType]
 * @returns {Promise<{ sessionId, heard, expect, actions, result, timings }>}
 */
export async function handleTurn({ sessionId, event, text, audio, mimeType, slug: chosenSlug = null }) {
  const t0 = Date.now();
  const session = getSession(sessionId);
  const timings = {};
  const steps = []; // { text } or { play } before speech is synthesized
  let heard = null;
  let result = null;
  let fromCache = false;
  let cacheable = 0; // steps that make up the answer itself, saved for offline replay

  if (event === "tap") {
    if (session.last?.clips?.length) {
      steps.push({ say: PHRASES.replay });
      for (const c of session.last.clips) steps.push({ play: { ...c, slug: c.slug ?? session.last.slug } });
    } else {
      steps.push({ say: PHRASES.nothing_to_replay });
    }
  } else if (event === "question" || event === "choose") {
    if (event === "choose") {
      // A tapped choice on a screen; the spoken equivalent is resolved below.
      const o = session.pending?.type === "choose_visit" && session.pending.options.find((x) => x.slug === chosenSlug);
      heard = o ? o.title : "";
    } else if (audio) {
      const ts = Date.now();
      try {
        heard = (await transcribeQuestion(audio, { mimeType, hints: medicationHints(await listVisits()) })).trim();
      } catch (err) {
        if (err instanceof TranscriptionUnavailable) throw err;
        console.error("transcription failed", err.message);
        heard = null;
        steps.push({ say: PHRASES.offline });
      }
      timings.sttMs = Date.now() - ts;
    } else {
      heard = String(text ?? "").trim().slice(0, 500);
    }

    if (steps.length) {
      // transcription failed; the offline phrase is already queued
    } else if (!heard) {
      steps.push({ say: PHRASES.didnt_catch });
    } else if (session.pending?.type === "ask_family" && classifyYesNo(heard)) {
      steps.push(...(await resolvePending(session, classifyYesNo(heard))));
    } else {
      // Anything else is a new question, unless it says which visit was meant.
      const p = session.pending;
      session.pending = null;
      const [visits, requests, household] = await Promise.all([listVisits(), listRequests(), getHousehold()]);
      const helper = household.helpers[0] ?? null;
      let question = heard;
      let visitSlug = null;
      if (p?.type === "choose_visit") {
        visitSlug = chosenSlug && p.options.some((o) => o.slug === chosenSlug) ? chosenSlug : await resolveChoice(p, heard, visits);
        if (visitSlug) question = p.question;
      }
      try {
        result = await remember(question, visits, { requests, helperName: helper?.name ?? null, visitSlug });
      } catch (err) {
        // Most likely no internet. Replay a rehearsed answer if there is one.
        console.error("remember failed", err.message);
        const cached = await findCachedTurn(heard);
        timings.totalMs = Date.now() - t0;
        // Say that it's a saved answer, so nobody takes it for a fresh one.
        const actions = cached ? [...(await toActions([{ say: PHRASES.offline_saved }])), ...cached.actions] : await toActions([{ say: PHRASES.offline }]);
        return { sessionId: session.id, heard, expect: "question", actions: [...actions, { type: "listen", expect: "question" }], result: null, fromCache: Boolean(cached), timings };
      }
      Object.assign(timings, result.timings);

      if (result.status === "choose_visit") {
        session.pending = { type: "choose_visit", question: result.question, options: result.options };
        steps.push({ say: `${result.speech} ${CHOICE_HINT}` });
        return finish();
      }
      steps.push({ say: result.speech });
      for (const c of result.clips) steps.push({ play: { ...c, slug: c.slug ?? result.visit.slug } });
      session.last = result.clips.length ? { slug: result.visit.slug, clips: result.clips } : session.last;
      cacheable = steps.length;

      if (result.nextStep?.type === "ask_family" && helper) {
        const visit = visits.find((v) => v.slug === result.visit.slug);
        const item = visit && findItem(visit.recap, result.nextStep.followUpId);
        if (item) {
          session.pending = { type: "ask_family", slug: visit.slug, itemId: item.id, helperId: helper.id, helperName: helper.name, title: item.title };
          steps.push({ say: `Would you like me to ask ${helper.name} to help with this? Hold the button and say yes or no.` });
        }
      }
    }
  } else {
    throw new Error(`Unknown event: ${event}`);
  }
  return finish();

  async function finish() {
    const ts = Date.now();
    const actions = await toActions(steps);
    timings.ttsMs = Date.now() - ts;
    timings.totalMs = Date.now() - t0;
    // The offer to ask family isn't saved: offline, its yes/no has no session behind it.
    if (result && cacheable) await rememberTurn(heard, actions.slice(0, cacheable)).catch(() => {});
    const expect = expectFor(session);
    return { sessionId: session.id, heard, expect, actions: [...actions, { type: "listen", expect }], result, fromCache, timings };
  }
}

const CHOICE_HINT = "Hold the button and tell me which.";
const expectFor = (session) => ({ ask_family: "yes_no", choose_visit: "choice" })[session.pending?.type] ?? "question";

/** The visit a spoken reply to "which visit do you mean?" points to, or null if it reads as a new question. */
async function resolveChoice(pending, reply, visits) {
  const picked = pickOption(reply, pending.options);
  if (picked) return picked.slug;
  if (reply.split(/\s+/).length > 10) return null;
  const offered = pending.options.map((o) => visits.find((v) => v.slug === o.slug)).filter(Boolean);
  try {
    const { visit } = await routeQuestion(pending.question, offered, { today: new Date().toISOString().slice(0, 10), clarification: reply });
    return visit?.slug ?? null;
  } catch {
    return null;
  }
}

async function resolvePending(session, answer) {
  const p = session.pending;
  session.pending = null;
  if (answer === "no") return [{ say: PHRASES.cancelled }];
  const visit = await getVisit(p.slug);
  try {
    const res = await requestHelp(visit, { itemId: p.itemId, helperId: p.helperId, message: "Could you help me with this?", includeHeadline: false });
    return [{ say: res.existing ? `${p.helperName} already has this one. I'll let you know when there's news.` : `Okay. I've asked ${p.helperName} to help with: ${p.title}.` }];
  } catch (err) {
    if (err instanceof RequestError && err.code === "unchecked_medication") {
      return [{ say: "That one depends on a medication that hasn't been checked yet, so I haven't sent it. Please check it in the Tandem app first." }];
    }
    throw err;
  }
}

async function toActions(steps) {
  return Promise.all(
    steps.map(async (s) => {
      if (s.play) {
        const c = s.play;
        return { type: "play", url: clipUrl(c.slug, c), start: c.start, end: c.end, speaker: c.speaker, text: c.text, visit: c.slug };
      }
      // Registered only; the audio is generated and streamed when the device fetches it.
      return { type: "speak", text: s.say, url: await speechUrl(s.say) };
    }),
  );
}
