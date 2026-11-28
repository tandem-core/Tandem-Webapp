// "Remember": one spoken question, answered from whichever recorded visit it's
// about, followed by the doctor's own words from the recording.
//
// Steps: pick the visit (one Claude call over a short index of visits), answer
// with Ask (which already follows the medication check), then build what the
// client needs to speak and play. Picking defaults to the most recent visit, so
// "what did the doctor say?" means the last appointment.
import { callStructured, s } from "./claude.mjs";
import { askConversation } from "./ask.mjs";
import { needsReview, unresolvedMedsFor } from "./medications.mjs";
import { visibleItems } from "./review.mjs";
import { longDate } from "./format.mjs";
import { buildExcerpts } from "./excerpts.mjs";
import { answerAcross } from "./ask-across.mjs";

const MAX_CLIPS = 2;

const ROUTE_SYSTEM = `You route an older adult's spoken question to one of their recorded health conversations in Tandem. You see a short index of their recordings, newest first, and today's date.

Pick the one recording the question is about:
- If the question names a date, a clinician, a medicine, a test, or a topic that only one recording covers, pick that one. Resolve relative dates ("last week", "my October 21st appointment") against today's date.
- If the question is general ("what did the doctor say?", "when's my next appointment?") or fits several recordings equally, pick the most recent one.
- If the question is about health but no recording covers it (a supplement, a symptom, a drug never mentioned), pick the most recent one; the answer will say it wasn't discussed.

First set topic: "health" for anything about their health, body, medicines, supplements, symptoms, tests, appointments, clinicians or care; "other" only for things unrelated to health (weather, news, sports, general chat). Then pick the recording; for "other", return null.

Then list otherMatches: other recordings the question could just as well be about. This is how Tandem knows to ask "which visit do you mean?" instead of answering from the wrong one, so:
- Include a recording when the specific thing the question asks about (a medicine, a test, a dose, a body part, a person) appears in it too, and nothing in the question (a date, a clinician, another detail) tells the recordings apart. Example: three recordings mention ibuprofen and the question is "what did they say about ibuprofen?" → pick the most recent and list the other two.
- A recording only counts if it covers everything the question names. "Can I take ibuprofen with methotrexate?" names methotrexate too, so only the methotrexate recording fits; "what did the pharmacist say about ibuprofen and my blood pressure medicine?" fits only the blood pressure recording.
- Leave it empty when only one recording covers that thing, when the question narrows it to one, or when the question is general ("what did the doctor say?", "when's my next appointment?").
- Don't count loose word overlap: "blood pressure", "blood thinner" and "blood test" are different things.

Medicine names in the index are spelled as the transcript has them, which may be misspelled. Match on what the question is about, not exact spelling.`;

const ROUTE_SCHEMA = s.obj({
  topic: s.enum(["health", "other"], "Decided first: is the question about their health at all?"),
  visitNumber: s.nullable({ type: "integer", description: "Number of the chosen recording from the index, or null" }),
  otherMatches: s.arr({ type: "integer" }, "Numbers of other recordings that fit the question equally well; usually empty"),
  reason: s.str("Short phrase on why this recording, for logs"),
});

const MAX_CHOICES = 3;

/** Compact, owner-safe description of each visit for routing. */
export function visitIndex(visits) {
  return visits
    .map((v, i) => {
      const c = v.conversation;
      const date = c.recordedAt ? c.recordedAt.slice(0, 10) : "unknown date";
      const todo = visibleItems(v.recap, "followUps").map((f) => f.title).slice(0, 4);
      const meds = (v.medications?.medications ?? []).map((m) => m.spellings[0]).slice(0, 8);
      return [
        `${i + 1}. ${date}: ${c.title}`,
        v.recap?.headline ? `   Summary: ${v.recap.headline}` : null,
        todo.length ? `   To do: ${todo.join("; ")}` : null,
        meds.length ? `   Medicines mentioned: ${meds.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

/**
 * @returns {{ visit, choices: object[], reason, topic }}  choices holds two or
 *   more visits (newest first) when the question fits several equally; visit is
 *   still the best single guess.
 */
export async function routeQuestion(question, visits, { today, client, clarification = null } = {}) {
  if (!visits.length) return { visit: null, choices: [], reason: "no recordings" };
  const asked = clarification
    ? `${question}\n\nAsked which recording they meant, they said: "${clarification}". Pick the one that reply points to; leave otherMatches empty.`
    : question;
  const user = `Today: ${today}\n\nRecordings (newest first):\n${visitIndex(visits)}\n\nQuestion: ${asked}`;
  const { data } = await callStructured({ system: ROUTE_SYSTEM, user, schema: ROUTE_SCHEMA, effort: "low", client });
  const valid = (n) => Number.isInteger(n) && n >= 1 && n <= visits.length;
  const n = data.visitNumber;
  let visit = valid(n) ? visits[n - 1] : null;
  // A health question with no obvious recording still deserves an answer from
  // the latest one ("that wasn't discussed"), never "I can only answer questions
  // about your recordings". The model sometimes returns null here despite the
  // prompt, so the rule is enforced in code.
  if (!visit && data.topic !== "other") visit = visits[0];
  let choices = [];
  if (visit && !clarification) {
    const numbers = [...new Set([n, ...(data.otherMatches ?? [])].filter(valid))].sort((a, b) => a - b);
    if (numbers.length > 1) choices = numbers.slice(0, MAX_CHOICES).map((i) => visits[i - 1]);
  }
  return { visit, choices, reason: data.reason, topic: data.topic };
}

// "one" is left out of the first: "the heartburn one" names a topic, not a position.
const ORDINALS = [/\b(first|1st)\b/, /\b(second|2nd|two)\b/, /\b(third|3rd|three)\b/];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const STOP = new Set(["the", "and", "for", "with", "visit", "check", "review", "discussion", "about", "your", "that", "one"]);

/**
 * Which offered visit a short reply ("the first one", "November 3rd", "the
 * heartburn one") points to, without a model call. Null when it can't tell.
 * @param {string} reply
 * @param {{ slug, title, recordedAt }[]} options  in the order they were read out
 */
export function pickOption(reply, options) {
  const t = String(reply ?? "").toLowerCase();
  const only = (xs) => (xs.length === 1 ? xs[0] : null);
  for (let i = 0; i < Math.min(options.length, ORDINALS.length); i++) {
    if (ORDINALS[i].test(t) && !ORDINALS.some((re, j) => j !== i && re.test(t))) return options[i];
  }
  if (/\b(latest|most recent|newest|recent one)\b/.test(t)) return options[0];
  const month = MONTHS.findIndex((m) => t.includes(m) || new RegExp(`\\b${m.slice(0, 3)}\\b`).test(t));
  if (month >= 0) {
    const inMonth = options.filter((o) => Number(o.recordedAt?.slice(5, 7)) === month + 1);
    const day = t.match(/\b(\d{1,2})(st|nd|rd|th)?\b/)?.[1];
    const exact = day ? inMonth.filter((o) => Number(o.recordedAt.slice(8, 10)) === Number(day)) : [];
    const hit = only(exact) ?? only(inMonth);
    if (hit) return hit;
  }
  const said = new Set(t.replace(/[^a-z0-9 ]/g, " ").split(/\s+/));
  const byTitle = options.filter((o) =>
    String(o.title).toLowerCase().split(/[^a-z0-9]+/).some((w) => w.length >= 4 && !STOP.has(w) && said.has(w)),
  );
  return only(byTitle);
}

const monthDay = (iso) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" }) : null;

/** "Do you mean your November 3 visit about heartburn medicine review, or your October 27 visit about ...?" */
export function choicePrompt(options) {
  const parts = options.map((o) => `your ${monthDay(o.recordedAt) ?? "earlier"} visit about ${String(o.title).toLowerCase()}`);
  const list = parts.length === 2 ? parts.join(", or ") : `${parts.slice(0, -1).join(", ")}, or ${parts.at(-1)}`;
  return `That came up in more than one visit. Do you mean ${list}?`;
}

/**
 * @param {string} question  typed or transcribed
 * @param {object[]} visits  from listVisits(); only those with a recap are used
 * @param {object} [opts]
 * @param {object[]} [opts.requests]  help requests, to avoid offering a duplicate
 * @param {string} [opts.ownerHelperName]  first helper's name for the offer
 * @param {string} [opts.today]  YYYY-MM-DD
 * @returns {Promise<RememberResult>}
 *
 * RememberResult {
 *   status: "answered" | "partly_answered" | "not_discussed" | "no_visit" | "no_recordings" | "choose_visit"
 *   options: { slug, title, recordedAt }[]   only for choose_visit, newest first; ask again with visitSlug
 *   speech: string            what the client should say aloud, before playing clips
 *   answer: string            the answer alone, for display
 *   visit: { slug, title, recordedAt } | null
 *   clips: { idx, start, end, text, speaker }[]   played after speech, in order
 *   audioUrl: string | null
 *   nextStep: { type: "ask_family", followUpId, label } | { type: "check_medication", medId, label } | null
 *   followUpQuestion: string | null
 * }
 */
export async function remember(question, visits, { requests = [], helperName = null, today, client, routeClient, visitSlug = null } = {}) {
  const q = String(question ?? "").trim();
  if (!q) throw new Error("Question is empty");
  const usable = visits
    .filter((v) => v.recap)
    .sort((a, b) => String(b.conversation.recordedAt).localeCompare(String(a.conversation.recordedAt)));
  const todayStr = today ?? new Date().toISOString().slice(0, 10);

  if (!usable.length) {
    const speech = "You don't have any recorded conversations yet. Press Record at your next appointment.";
    return { status: "no_recordings", speech, answer: speech, visit: null, clips: [], audioUrl: null, nextStep: null, followUpQuestion: null };
  }

  const t0 = Date.now();
  // visitSlug: the owner already said which visit (after being asked to choose).
  const chosen = visitSlug ? usable.find((v) => v.slug === visitSlug) : null;
  const { visit, choices = [] } = chosen ? { visit: chosen } : await routeQuestion(q, usable, { today: todayStr, client: routeClient ?? client });
  const routeMs = Date.now() - t0;
  // Testing track: with TANDEM_ACROSS set, answer from all recordings (lib/ask-across.mjs),
  // which asks "which visit?" itself only when the answer would really differ.
  if (process.env.TANDEM_ACROSS && visit) {
    const t1 = Date.now();
    const r = await answerAcross(q, visit, choices, usable, { today: todayStr, client });
    const main = r.visit && usable.find((v) => v.slug === r.visit.slug);
    const nextStep = main && r.status === "answered" ? nextStepFor(main, r.evidence ?? [], requests, helperName) : null;
    return { ...r, nextStep, timings: { routeMs, answerMs: Date.now() - t1 } };
  }
  if (choices.length > 1) {
    // Answering from the wrong visit is worse than one more question.
    const options = choices.map((v) => ({ slug: v.slug, title: v.conversation.title, recordedAt: v.conversation.recordedAt }));
    const speech = choicePrompt(options);
    return { status: "choose_visit", speech, answer: speech, question: q, options, visit: null, clips: [], audioUrl: null, nextStep: null, followUpQuestion: null, timings: { routeMs } };
  }
  if (!visit) {
    const speech = "I can only answer questions about your recorded conversations. Try asking what the doctor said.";
    return { status: "no_visit", speech, answer: speech, visit: null, clips: [], audioUrl: null, nextStep: null, followUpQuestion: null, timings: { routeMs } };
  }

  const t1 = Date.now();
  const r = await askConversation(visit.conversation, q, { medications: visit.medications, client, style: "spoken" });
  const c = visit.conversation;
  const when = c.recordedAt ? longDate(c.recordedAt) : null;
  const intro = `From your ${when ? `${when} ` : ""}recording.`;
  // Whole sentences around the most important lines, merged where they touch,
  // so playback neither starts mid-thought nor repeats audio at a join.
  const clips = r.status === "not_discussed" ? [] : buildExcerpts(c, r.support, { maxExcerpts: MAX_CLIPS });

  return {
    status: r.status,
    question: q,
    speech: `${intro} ${r.answer}${clips.length ? " Here's what was said." : ""}`,
    answer: r.answer,
    visit: { slug: visit.slug, title: c.title, recordedAt: c.recordedAt },
    clips,
    audioUrl: `/api/audio/${visit.slug}`,
    nextStep: nextStepFor(visit, r.evidence, requests, helperName),
    followUpQuestion: r.followUpQuestion,
    timings: { routeMs, answerMs: Date.now() - t1 },
  };
}

/**
 * One offer, chosen without the model: check an unconfirmed medication the
 * answer rests on, or else ask family to help with a follow-up the answer cites.
 */
export function nextStepFor(visit, evidence, requests = [], helperName = null) {
  const unchecked = unresolvedMedsFor(visit.medications, evidence).filter(needsReview);
  if (unchecked.length) {
    return { type: "check_medication", medId: unchecked[0].id, label: "Check this medication by listening" };
  }
  const cited = new Set(evidence);
  const open = new Set(
    requests
      .filter((x) => x.conversationId === visit.conversation.id && ["requested", "accepted", "done"].includes(x.status))
      .map((x) => x.followUpId),
  );
  const f = visibleItems(visit.recap, "followUps").find(
    (item) =>
      item.delegable &&
      item.status === "to_do" &&
      !open.has(item.id) &&
      item.evidence.some((i) => cited.has(i)) &&
      !unresolvedMedsFor(visit.medications, item.evidence).length,
  );
  if (!f) return null;
  return { type: "ask_family", followUpId: f.id, label: `Ask ${helperName ?? "family"} to help: ${f.title}` };
}
