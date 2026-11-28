// Testing track only. Mary's running medicine list across appointments, built from each
// recording's medication review (lib/medications.mjs, already run on every recording), so
// no extra AI call or storage. Every entry keeps its date, appointment and the transcript
// line that supports it.

const KEEPS = ["started", "changed", "existing", "stopped", "avoid", "not_chosen"];

const nameOf = (m) => (m.nameState === "clear" ? (m.rxnorm?.name ?? m.heardAs) : `"${m.heardAs}" (name unclear)`).toLowerCase();

/**
 * @param {{ slug, conversation, medications }[]} visits
 * @returns {{ medicine, change, detail, dose, date, slug, title, line, quote }[]} oldest first
 */
export function medicineLog(visits) {
  const entries = [];
  for (const v of visits) {
    for (const m of v.medications?.medications ?? []) {
      if (!KEEPS.includes(m.role)) continue;
      const lastDose = m.doseStatements?.at(-1);
      const line = lastDose?.evidence?.[0] ?? m.evidence?.[0] ?? null;
      entries.push({
        medicine: nameOf(m),
        medId: m.id,
        change: m.role,
        detail: m.roleDetail ?? "",
        dose: lastDose?.text ?? null,
        date: String(v.conversation.recordedAt ?? "").slice(0, 10),
        slug: v.slug,
        title: v.conversation.title,
        line,
        quote: line === null ? null : (v.conversation.segments[line]?.text ?? null),
      });
    }
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

/** The latest entry for each medicine still being taken (not stopped or ruled out since). */
export function currentMedicines(log) {
  const latest = new Map();
  for (const e of log) latest.set(e.medicine, e);
  return [...latest.values()].filter((e) => ["started", "changed", "existing"].includes(e.change));
}

/** The list as prompt text: every change in date order, then what's current. */
export function medicineLogText(log) {
  const line = (e) => `- ${e.date} "${e.title}": ${e.medicine} ${e.change}. ${e.detail}${e.quote ? ` Said: "${e.quote}"` : ""}`;
  const now = currentMedicines(log).map((e) => `- ${e.medicine}${e.dose ? `: ${e.dose}` : ""} (as of ${e.date})`);
  return `Medicine changes, oldest first:\n${log.map(line).join("\n") || "(none)"}\n\nTaking now, by the latest recording:\n${now.join("\n") || "(none)"}`;
}
