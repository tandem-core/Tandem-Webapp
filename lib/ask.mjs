// "Ask Tandem": answers the owner's question from one conversation's transcript,
// and says plainly when the answer isn't in it.
import { callStructured, s } from "./claude.mjs";
import { transcriptText } from "./conversation.mjs";
import { medicationGuidance } from "./medications.mjs";

const guidance = (review) => {
  const g = medicationGuidance(review);
  return g ? `

${g}` : "";
};

const SYSTEM = `You answer an older adult's questions about one recorded conversation, usually a medical appointment, for Tandem. They are asking because they don't remember exactly what was said, and they will act on your answer.

Answer only from the transcript. Speak to them as "you", in one to three short sentences, keeping the clinician's specifics (dates, doses, names, places).

Pick a status:
- "answered": the transcript directly answers the question.
- "partly_answered": the transcript covers part of it, or the clinician gave a partial answer and deferred the rest. Say which part is covered and what was left open.
- "not_discussed": the topic didn't come up. Say so directly, e.g. "That wasn't discussed in this visit." If something nearby was discussed, you may mention it in one sentence, but don't let it read as an answer.

Speech-to-text transcripts often lack speaker names or label everyone "Speaker". When a question names a role ("what did the pharmacist say") and the transcript doesn't say who spoke, answer from what was said in the conversation and don't treat the missing label as the topic not being discussed.

If the answer depends on a medication name or amount the medication check marks as unconfirmed, unclear or conflicting, use "partly_answered", say what was unclear, cite the line so they can listen, and suggest confirming with their care team.

Never fill a gap with general medical knowledge, and don't guess what the clinician would say. If they ask what they should do and the clinician didn't say, suggest they ask the clinic, and offer a question they could ask. Back the answer with support: for each transcript line you rely on, its line number and the exact words in it that say what you're claiming, copied character for character from that line (a short phrase, roughly 4 to 15 words; it may run on into the next line). Most important first: the first one or two are played aloud as proof, so start with the words where the clinician states the answer itself (the test, the amount, the date, the instruction), not background or a neighbouring topic. For "not_discussed", give only lines you mention as nearby context, or none. Never mention line numbers or timestamps in the answer itself: the app plays and shows those lines, and the owner doesn't see numbers.

The transcript doesn't tell you anyone's gender, so never use he, she, him, her, his or hers for the clinician or anyone else. Use the name or role, or rephrase: "Dr. Patel said not to change it", not "She said she doesn't want to change it".`;

export const ANSWER_SCHEMA = s.obj({
  status: s.enum(["answered", "partly_answered", "not_discussed"]),
  answer: s.str("What to say to the owner, 1-3 short sentences."),
  support: s.arr(
    s.obj({
      line: { type: "integer", description: "Transcript line number" },
      quote: s.str("The exact words from that line that back the claim, copied verbatim"),
    }),
    "Most important first; may be empty for not_discussed.",
  ),
  followUpQuestion: s.nullable(s.str("A question the owner could ask the clinic, when the transcript leaves them without an answer.")),
});

const GENDERED = /\b(she|he|her|hers|him|his)\b/i;

// Spoken answers are heard once, with no screen to reread, so they must be short.
const SPOKEN = `

This answer will be read aloud and followed by a recording of the clinician's own words. Use at most two short sentences, about 40 words, with the single most important point first. Leave out details the owner didn't ask about.`;

/**
 * @param {object} conversation
 * @param {string} question
 * @param {object} [opts]
 * @param {"written"|"spoken"} [opts.style]  "spoken" asks for a short answer for voice
 * @returns {Promise<{ status, answer, evidence: number[], ranked: number[], support: {line, quote}[], quotes: object[], followUpQuestion }>}
 *   evidence is in transcript order (for display); ranked and support are most important first.
 */
export async function askConversation(conversation, question, { client, effort = "medium", medications = null, style = "written" } = {}) {
  const q = String(question ?? "").trim();
  if (!q) throw new Error("Question is empty");

  const user = `Recording date: ${conversation.recordedAt?.slice(0, 10) ?? "unknown"}
Title: ${conversation.title}

Transcript (each line starts with its line number in brackets):
${transcriptText(conversation)}${guidance(medications)}

Question: ${q}`;

  const system = style === "spoken" ? SYSTEM + SPOKEN : SYSTEM;
  let { data } = await callStructured({ system, user, schema: ANSWER_SCHEMA, effort, client });
  // Haiku sometimes ignores the no-pronoun rule; one targeted retry fixes most
  // cases. The second answer is kept either way, since a pronoun can be right
  // when the transcript states someone's gender.
  if (GENDERED.test(data.answer)) {
    ({ data } = await callStructured({
      system,
      user: `${user}\n\nA previous draft said: "${data.answer}"\nRewrite it without he, she, him, her, his or hers for anyone whose gender the transcript doesn't state. Use names or roles.`,
      schema: ANSWER_SCHEMA,
      effort,
      client,
    }));
  }
  const maxIdx = conversation.segments.length - 1;
  // Most important first, as the model ranked them. The quotes are checked
  // against the transcript when clips are built (lib/excerpts.mjs).
  const support = (data.support ?? []).filter((x) => Number.isInteger(x?.line) && x.line >= 0 && x.line <= maxIdx);
  const ranked = [...new Set(support.map((x) => x.line))];
  const evidence = [...ranked].sort((a, b) => a - b);

  return {
    question: q,
    status: data.status,
    answer: data.answer,
    evidence,
    ranked,
    support,
    // The UI shows these under the answer with a play button seeking to `start`.
    quotes: evidence.map((i) => {
      const seg = conversation.segments[i];
      return { idx: i, speaker: seg.speakerName ?? seg.speaker, text: seg.text, start: seg.start, end: seg.end };
    }),
    followUpQuestion: data.followUpQuestion ?? null,
  };
}
