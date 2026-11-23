// Turns a Conversation into a reviewable visit recap: what to do, what was said,
// what is still open. Every item carries transcript line indices so the owner
// can see (and hear) where it came from.
import { callStructured, s } from "./claude.mjs";
import { transcriptText } from "./conversation.mjs";
import { medicationGuidance } from "./medications.mjs";

const guidanceBlock = (review) => {
  const g = medicationGuidance(review);
  return g ? `

${g}` : "";
};

const SYSTEM = `You prepare visit recaps for Tandem, an app used by older adults to remember what was said at medical appointments and to hand specific follow-ups to a family member they trust.

The owner reads the recap after the visit and corrects it before anything is shared. Write for them: short sentences, everyday words, the doctor's specifics kept (drug names, doses, dates, places). Address the owner as "you".

What the recap is for:
- followUps: things someone has to do after the visit. Note whether it's already arranged (the clinic booked it) or still to do. Mark delegable when a family member could reasonably do it or arrange it for the owner (booking, calling, picking up, driving them). A test or appointment the owner must attend is still delegable, because someone else can book it; only things nobody else can do or arrange (taking a pill, fasting) are not.
- instructions: how-to guidance the doctor gave that isn't a one-off task.
- unchanged: things the doctor explicitly said stay the same. Owners often worry something changed; "no change" is useful information.
- openQuestions: anything deferred, left undecided, or asked without a full answer.

Only include what is in the transcript. Each item cites the line numbers that support it. Resolve relative or spoken dates against the recording date and give dueBy as YYYY-MM-DD when a deadline was stated; otherwise null. dueBy is the date the clinician named, not a day earlier: "before December 14" and "by December 14" are both 12-14, and the app shows the word "before" or "by" from the when field. Refer to clinicians by name or role, never with a gendered pronoun, since the transcript doesn't establish one. When a detail was said once, quickly, or could be a transcription error, set confidence to "check_this" so the owner confirms it. Do not add medical advice, interpretation, or reassurance the clinician didn't give.`;

const CONFIDENCE = ["stated_clearly", "check_this"];

export const RECAP_SCHEMA = s.obj({
  headline: s.str("One sentence on what the visit was about and the main outcome."),
  followUps: s.arr(
    s.obj({
      title: s.str("Short imperative, e.g. 'Get fasting blood work'"),
      detail: s.str("The specifics the owner needs to act: what, where, how to prepare."),
      dueBy: s.nullable(s.str("YYYY-MM-DD deadline or appointment date")),
      when: s.nullable(s.str("Time or date as spoken, e.g. 'December 21 at 10:30'")),
      status: s.enum(["to_do", "already_scheduled"]),
      delegable: s.bool(),
      confidence: s.enum(CONFIDENCE),
      evidence: s.evidence(),
    }),
  ),
  instructions: s.arr(s.obj({ text: s.str(), confidence: s.enum(CONFIDENCE), evidence: s.evidence() })),
  unchanged: s.arr(s.obj({ text: s.str(), evidence: s.evidence() })),
  openQuestions: s.arr(
    s.obj({
      text: s.str(),
      resolvesWhen: s.nullable(s.str("What the clinician said it depends on, if anything")),
      evidence: s.evidence(),
    }),
  ),
});

/**
 * @param {object} conversation  see lib/conversation.mjs
 * @param {object} [opts]
 * @param {object} [opts.client]  injectable Anthropic client for tests
 * @returns {Promise<object>} recap with ids, validated evidence, and generation metadata
 */
export async function generateRecap(conversation, { client, effort = "high", medications = null } = {}) {
  if (!conversation.segments.length) throw new Error(`Conversation ${conversation.id} has no transcript`);

  const recordedOn = conversation.recordedAt ? conversation.recordedAt.slice(0, 10) : "unknown";
  const user = `Recording date: ${recordedOn}
Title: ${conversation.title}

Transcript (each line starts with its line number in brackets):
${transcriptText(conversation)}${guidanceBlock(medications)}`;

  const { data, usage, model } = await callStructured({ system: SYSTEM, user, schema: RECAP_SCHEMA, effort, client });
  return finalizeRecap(conversation, data, { usage, model });
}

// Model output is checked rather than trusted: evidence must point at real lines,
// and an item with no surviving evidence is downgraded so the owner checks it.
export function finalizeRecap(conversation, raw, meta = {}) {
  const maxIdx = conversation.segments.length - 1;
  const clean = (ev) => [...new Set((ev ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i <= maxIdx))].sort((a, b) => a - b);
  const isoDate = (d) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  const warnings = [];

  const withEvidence = (kind) => (item, i) => {
    const evidence = clean(item.evidence);
    if (evidence.length !== (item.evidence ?? []).length) warnings.push(`${kind}[${i}]: dropped out-of-range evidence`);
    const out = { id: `${kind}-${i + 1}`, ...item, evidence };
    if (!evidence.length) {
      warnings.push(`${kind}[${i}]: no valid evidence`);
      if ("confidence" in out) out.confidence = "check_this";
    }
    return out;
  };

  return {
    conversationId: conversation.id,
    headline: raw.headline,
    followUps: (raw.followUps ?? []).map((f, i) => ({ ...withEvidence("followUp")(f, i), dueBy: isoDate(f.dueBy) })),
    instructions: (raw.instructions ?? []).map(withEvidence("instruction")),
    unchanged: (raw.unchanged ?? []).map(withEvidence("unchanged")),
    openQuestions: (raw.openQuestions ?? []).map(withEvidence("openQuestion")),
    warnings,
    generatedAt: new Date().toISOString(),
    model: meta.model ?? null,
    usage: meta.usage ?? null,
  };
}
