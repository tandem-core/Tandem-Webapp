// Testing track only. Mary's running medicine list, newest change first. Each medicine
// carries its record from that appointment (as on the visit page) and whether its name
// or amount is still unclear, so the app can ask the same label check.
import { listVisits } from "../../../lib/store.mjs";
import { listRequests } from "../../../lib/db.mjs";
import { visitDetail } from "../../../lib/summaries.mjs";
import { medicineLog, currentMedicines } from "../../../lib/med-log.mjs";
import { json, options } from "../_lib/http.js";

export const OPTIONS = options;

export async function GET() {
  const [visits, requests] = await Promise.all([listVisits(), listRequests()]);
  const ready = visits.filter((v) => v.recap);
  const details = new Map(ready.map((v) => [v.slug, visitDetail(v, requests)]));
  const current = currentMedicines(medicineLog(ready))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(({ medicine, medId, change, detail, dose, date, slug, title }) => {
      const med = details.get(slug)?.medications.find((m) => m.id === medId) ?? null;
      return { medicine, change, detail, dose, date, slug, title, med, nameUnclear: med ? !med.nameResolved : false, amountUnclear: med ? !med.doseResolved : false };
    });
  return json({ current });
}