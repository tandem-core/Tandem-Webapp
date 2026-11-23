export function printRecap(recap) {
  const cite = (ev) => (ev.length ? ` [${ev.join(",")}]` : "");
  const flag = (i) => (i.confidence === "check_this" ? "  (check this)" : "");
  console.log(recap.headline);
  const section = (title, items, fmt) => {
    if (!items.length) return;
    console.log(`\n${title}`);
    for (const i of items) console.log(`  - ${fmt(i)}`);
  };
  section("To do", recap.followUps, (f) =>
    `${f.title}${f.dueBy ? ` by ${f.dueBy}` : ""}${f.status === "already_scheduled" ? " (already scheduled)" : ""}${f.delegable ? " [can ask family]" : ""}${flag(f)}${cite(f.evidence)}\n      ${f.detail}`,
  );
  section("Doctor's instructions", recap.instructions, (i) => `${i.text}${flag(i)}${cite(i.evidence)}`);
  section("No change", recap.unchanged, (u) => `${u.text}${cite(u.evidence)}`);
  section("Still open", recap.openQuestions, (q) => `${q.text}${q.resolvesWhen ? ` (depends on: ${q.resolvesWhen})` : ""}${cite(q.evidence)}`);
  if (recap.warnings.length) console.log(`\nWarnings: ${recap.warnings.join("; ")}`);
}
