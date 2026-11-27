// Testing track only. Answers a question from all of Mary's recordings at once: the
// running medicine list, every appointment's one-line summary, and the full transcripts
// of the two or three appointments routing found relevant. Same rules as ask.mjs; each
// quote names its appointment so the right recording plays.
import { callStructured, s } from "./claude.mjs";
import { transcriptText } from "./conversation.mjs";
import { medicationGuidance } from "./medications.mjs";
import { medicineLog, medicineLogText } from "./med-log.mjs";
import { longDate } from "./format.mjs";
import { buildExcerpts } from "./excerpts.mjs";
import { choicePrompt } from "./remember.mjs";

const MAX_TRANSCRIPTS = 3;
const MAX_CLIPS = 2;

const SCHEMA = s.obj({
  status: s.enum(["answered", "partly_answered", "not_discussed", "which_visit"]),
  answer: s.str("What to say to the owner, at most two short sentences."),
  support: s.arr(
    s.obj({
      appointment: s.str("The transcript's key, such as T1"),
      line: { type: "integer", description: "Transcript line number" },
      quote: s.str("The exact words from that line that back the claim, copied verbatim"),
    }),
    "Most important first; may be empty for not_discussed.",
  ),
  followUpQuestion: s.nullable(s.str("A question the owner could ask the clinic, when the recordings leave them without an answer.")),
});

const SYSTEM = `You answer an older adult's questions about their recorded health appointments for Tandem. They are asking because they don't remember exactly what was said, and they will act on your answer.

You get: a medicine list built from every appointment (each change with its date and the words said), a one-line summary of every appointment, and full transcripts of the appointments most likely to hold the answer (keys T1, T2, T3).

Answer only from these. Speak to them as "you". This answer is read aloud and followed by the clinician's own words, so use at most two short sentences, about 40 words, most important point first, keeping specifics (dates, doses, names).
- For "now" questions (current dose, still taking, latest plan), use the newest information and say when it was decided, e.g. "Since March 24, ...".
- For "what changed" questions, give the changes in date order.
- For "what medicines am I taking", list every medicine on the "Taking now" list with its dose (this list may run longer than two sentences), and say to check it with their pharmacist.
- "Last time" or "my last appointment" means the newest appointment that fits.
- Use "which_visit" only when the question asks about one particular appointment and two or more fit equally well, so any single answer could be the wrong one. If the answer is the same either way, or you can cover both in two sentences, answer instead.

Statuses: "answered"; "partly_answered" (part is covered, something was left open, or a medicine name or amount is marked unclear: say so and suggest confirming with their care team); "not_discussed" (say plainly it wasn't discussed in their recordings); "which_visit".

Never fill a gap with general medical knowledge. Back the answer with support from the transcripts only: the transcript key, the line number, and the exact words in that line (4 to 15 words, copied character for character). Most important first; the first one or two are played aloud. Never mention line numbers, keys or timestamps in the answer.

Never use he, she, him, her, his or hers for anyone. Use the name or role.`;

const key = (i) => `T${i + 1}`;

function prompt(question, today, visits, picked) {
  const summaries = visits.map((v) => `- ${String(v.conversation.recordedAt).slice(0, 10)} "${v.conversation.title}": ${v.recap?.headline ?? ""}`).join("\n");
  const transcripts = picked
    .map((v, i) => {
      const g = medicationGuidance(v.medications);
      return `${key(i)}: "${v.conversation.title}", ${String(v.conversation.recordedAt).slice(0, 10)}\n${transcriptText(v.conversation)}${g ? `\n\n${g}` : ""}`;
    })
    .join("\n\n");
  // Stable parts first, so repeat questions reuse the prompt cache.
  return `${medicineLogText(medicineLog(visits))}\n\nAll appointments, newest first:\n${summaries}\n\nTranscripts (each line starts with its line number in brackets):\n${transcripts}\n\nToday: ${today}\nQuestion: ${question}`;
}

/**
 * @param {string} question
 * @param {object} visit  the visit routing picked
 * @param {object[]} others  other visits routing said could fit
 * @param {object[]} visits  every visit, newest first
 * @returns the same shape as remember()
 */
export async function answerAcross(question, visit, others, visits, { today, client } = {}) {
  const picked = [visit, ...others.filter((v) => v !== visit)].slice(0, MAX_TRANSCRIPTS);
  const { data } = await callStructured({ system: SYSTEM, user: prompt(question, today, visits, picked), schema: SCHEMA, effort: "medium", client });

  if (data.status === "which_visit" && picked.length > 1) {
    const options = picked.map((v) => ({ slug: v.slug, title: v.conversation.title, recordedAt: v.conversation.recordedAt }));
    const speech = choicePrompt(options);
    return { status: "choose_visit", speech, answer: speech, question, options, visit: null, clips: [], audioUrl: null, nextStep: null, followUpQuestion: null };
  }

  // Quotes grouped by appointment, in the order the answer relies on them.
  const support = (data.support ?? []).filter((x) => picked[Number(String(x.appointment).replace(/\D/g, "")) - 1]);
  const order = [...new Set(support.map((x) => x.appointment))];
  const clips = [];
  if (data.status !== "not_discussed") {
    for (const k of order) {
      const v = picked[Number(k.replace(/\D/g, "")) - 1];
      const mine = support.filter((x) => x.appointment === k).map(({ line, quote }) => ({ line, quote }));
      for (const c of buildExcerpts(v.conversation, mine, { maxExcerpts: MAX_CLIPS - clips.length })) clips.push({ ...c, slug: v.slug });
      if (clips.length >= MAX_CLIPS) break;
    }
  }
  const main = clips[0] ? picked.find((v) => v.slug === clips[0].slug) : visit;
  const used = new Set(clips.map((c) => c.slug));
  const intro = used.size > 1 ? "From your recordings." : `From your ${longDate(main.conversation.recordedAt)} recording.`;
  return {
    status: data.status === "which_visit" ? "answered" : data.status,
    question,
    speech: `${intro} ${data.answer}${clips.length ? " Here's what was said." : ""}`,
    answer: data.answer,
    visit: { slug: main.slug, title: main.conversation.title, recordedAt: main.conversation.recordedAt },
    clips,
    audioUrl: `/api/audio/${main.slug}`,
    nextStep: null,
    followUpQuestion: data.followUpQuestion ?? null,
  };
}
