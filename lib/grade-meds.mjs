// Checks a medication review against expectations, plus invariants that hold for
// every conversation: quoted doses really are in the cited lines, and nothing is
// suggested without support from the conversation.
import { needsReview, doseNeedsCheck } from "./medications.mjs";

const lc = (x) => String(x ?? "").toLowerCase();
const squash = (x) => lc(x).replace(/[^a-z0-9]+/g, " ").trim();

function namesOf(m) {
  return [...m.spellings, m.rxnorm?.name, m.suggestion?.name].filter(Boolean).map(lc);
}

export function gradeMedications(review, conversation, expected = { meds: [], noReviewFor: [] }) {
  const checks = [];
  const add = (name, pass, note = "") => checks.push({ name, pass: Boolean(pass), note });
  const find = (key) => review.medications.find((m) => namesOf(m).some((n) => n.includes(lc(key))));

  for (const e of expected.meds ?? []) {
    const m = find(e.match);
    add(`found ${e.match}`, m, m ? "" : `got: ${review.medications.map((x) => x.spellings[0]).join(", ")}`);
    if (!m) continue;
    if ("needsReview" in e) add(`  ${e.match} ${e.needsReview ? "needs" : "doesn't need"} review`, needsReview(m) === e.needsReview, `nameState ${m.nameState}`);
    if (e.suggestion) add(`  suggests ${e.suggestion}`, lc(m.suggestion?.name).includes(lc(e.suggestion)), `suggestion ${m.suggestion?.name ?? "none"}`);
    if ("doseConflict" in e) add(`  dose conflict ${e.doseConflict}`, m.doseConflict === e.doseConflict);
    if ("doseFlagged" in e) add(`  amount ${e.doseFlagged ? "flagged" : "not flagged"} (conflict, correction or unclear)`, doseNeedsCheck(m) === e.doseFlagged, `conflict ${m.doseConflict}, corrected ${m.doseCorrected}`);
    if (e.unclearDose) add("  unclear dose flagged", m.doseStatements.some((d) => d.unclear));
    for (const d of e.doseMentions ?? []) add(`  dose mentions ${d}`, m.doseStatements.some((s) => lc(s.text).includes(lc(d))));
    if (e.role) add(`  role ${e.role.join("|")}`, e.role.includes(m.role), `got ${m.role}`);
  }
  for (const key of expected.noReviewFor ?? []) {
    const m = find(key);
    add(`no false alarm: ${key}`, !m || !needsReview(m), m ? `nameState ${m.nameState}` : "");
  }

  // Invariants.
  const invented = [];
  for (const m of review.medications) {
    for (const d of m.doseStatements) {
      const cited = squash(d.evidence.map((i) => conversation.segments[i]?.text).join(" "));
      if (!d.evidence.length || !cited.includes(squash(d.text))) invented.push(`${m.spellings[0]}: "${d.text}"`);
    }
  }
  add("every dose is quoted verbatim from its cited lines", invented.length === 0, invented.join("; "));
  const unsupported = review.medications.filter((m) => m.suggestion && !m.suggestion.basis.includes("context"));
  add("no suggestion without conversational support", unsupported.length === 0);
  return checks;
}
