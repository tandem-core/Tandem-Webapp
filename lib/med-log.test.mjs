// node --test lib/med-log.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { currentMedicines, medicineLog } from "./med-log.mjs";

const visit = (slug, date, meds) => ({
  slug,
  conversation: { recordedAt: `${date}T15:00:00Z`, title: slug, segments: [{ text: "line 0" }, { text: "Take 10 milligrams once a day." }] },
  medications: { medications: meds },
});
const med = (heardAs, role, dose) => ({ heardAs, nameState: "clear", role, roleDetail: "", doseStatements: dose ? [{ text: dose, evidence: [1] }] : [], evidence: [0] });

test("the current list follows changes, stops and restarts in date order", () => {
  const log = medicineLog([
    visit("b", "2026-03-24", [med("amlodipine", "started", "5 milligrams")]),
    visit("a", "2025-06-12", [med("ramipril", "changed", "10 milligrams"), med("naproxen", "stopped"), med("amlodipine", "existing", "10 milligrams")]),
    visit("c", "2025-09-23", [med("amlodipine", "stopped"), med("celecoxib", "avoid"), med("joan's pill", "discussed")]),
  ]);
  assert.deepEqual(log.map((e) => `${e.date} ${e.medicine} ${e.change}`), [
    "2025-06-12 ramipril changed",
    "2025-06-12 naproxen stopped",
    "2025-06-12 amlodipine existing",
    "2025-09-23 amlodipine stopped",
    "2025-09-23 celecoxib avoid",
    "2026-03-24 amlodipine started",
  ]);
  assert.equal(log[0].quote, "Take 10 milligrams once a day.");
  assert.deepEqual(currentMedicines(log).map((e) => `${e.medicine} ${e.dose}`), ["ramipril 10 milligrams", "amlodipine 5 milligrams"]);
});
