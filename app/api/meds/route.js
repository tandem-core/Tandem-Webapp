// Testing track only. Mary's running medicine list plus the label checks still open.
import { listVisits } from "../../../lib/store.mjs";
import { listRequests } from "../../../lib/db.mjs";
import { visitDetail } from "../../../lib/summaries.mjs";
import { medicineLog, currentMedicines } from "../../../lib/med-log.mjs";
import { json, options } from "../_lib/http.js";

export const OPTIONS = options;

export async function GET() {
  const [visits, requests] = await Promise.all([listVisits(), listRequests()]);
  const ready = visits.filter((v) => v.recap);
  const current = currentMedicines(medicineLog(ready))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(({ medicine, change, detail, dose, date, slug, title }) => ({ medicine, change, detail, dose, date, slug, title }));
  const checks = ready.flatMap((v) =>
    visitDetail(v, requests)
      .medications.filter((m) => m.needsReview)
      .map((med) => ({ slug: v.slug, title: v.conversation.title, recordedAt: v.conversation.recordedAt, med })),
  );
  return json({ current, checks });
}