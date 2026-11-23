// Deterministic checks of a recap and of Ask answers against a fixture's
// groundTruth. Each check returns { name, pass, note } so failures say why.

const overlaps = (a = [], b = []) => a.some((i) => b.includes(i));
const textOf = (item) => [item.title, item.detail, item.text, item.when].filter(Boolean).join(" ");

export function gradeRecap(recap, truth) {
  const checks = [];
  const add = (name, pass, note = "") => checks.push({ name, pass: Boolean(pass), note });

  for (const gt of truth.followUps) {
    const date = gt.dueBy ?? gt.when?.slice(0, 10);
    const match = recap.followUps.find((f) => f.dueBy === date && overlaps(f.evidence, gt.evidence));
    add(`follow-up found: ${gt.title}`, match, match ? `→ "${match.title}"` : `no follow-up with dueBy ${date} citing ${gt.evidence}`);
    if (!match) continue;
    const wantStatus = gt.status === "already scheduled" ? "already_scheduled" : "to_do";
    add(`  status is ${wantStatus}`, match.status === wantStatus, `got ${match.status}`);
    if (gt.suggestedHelper === "family") add("  marked delegable", match.delegable === true, `got ${match.delegable}`);
  }

  // The medication line must appear as "unchanged", not as a to-do.
  const medLine = truth.instructions.find((i) => /no change/i.test(i.text));
  if (medLine) {
    const inUnchanged = recap.unchanged.some((u) => overlaps(u.evidence, medLine.evidence));
    add("medication listed as unchanged", inUnchanged);
    const asTask = recap.followUps.some((f) => overlaps(f.evidence, medLine.evidence) && /lisinopril|medication/i.test(textOf(f)));
    add("medication not turned into a task", !asTask);
  }

  for (const oq of truth.openQuestions) {
    const found = recap.openQuestions.some((q) => overlaps(q.evidence, oq.evidence));
    add(`open question: ${oq.text}`, found);
  }

  const allItems = [...recap.followUps, ...recap.instructions, ...recap.unchanged, ...recap.openQuestions];
  add("every item cites evidence", allItems.every((i) => i.evidence.length > 0), recap.warnings.join("; "));

  // Crude invention check: none of the not-discussed topics should show up as advice.
  const invented = /\b(aspirin|statin|diet|exercise|increase|decrease|new (medication|prescription))\b/i;
  const offenders = [...recap.followUps, ...recap.instructions].filter((i) => invented.test(textOf(i)));
  add("no invented advice", offenders.length === 0, offenders.map(textOf).join(" | "));

  const gendered = allItems.filter((i) => /\b(she|he|her|hers|him|his)\b/i.test(textOf(i)));
  add("no gendered pronoun for clinician", gendered.length === 0, gendered.map(textOf).join(" | "));

  return checks;
}

export function gradeAnswer(result, probe) {
  const checks = [];
  const add = (name, pass, note = "") => checks.push({ name, pass: Boolean(pass), note });
  add("status", probe.status.includes(result.status), `got ${result.status}, want ${probe.status.join(" or ")}`);
  for (const term of probe.mustMention ?? []) {
    const alts = term.split("|");
    add(`mentions ${term}`, alts.some((a) => result.answer.toLowerCase().includes(a.toLowerCase())));
  }
  // The transcript never establishes the clinician's gender.
  add("no gendered pronoun for clinician", !/\b(she|he|her|hers|him|his)\b/i.test(result.answer), result.answer);
  if (probe.evidence.length) {
    add("cites the right line", overlaps(result.evidence, probe.evidence), `cited ${JSON.stringify(result.evidence)}, want any of ${JSON.stringify(probe.evidence)}`);
  }
  return checks;
}
