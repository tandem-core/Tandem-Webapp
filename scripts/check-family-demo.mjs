// Exercise the actual server-side sharing filter without a running Next server.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { randomUUID } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = new Map();
const localData = new Map();
const browser = {
  localStorage: { getItem: (key) => localData.get(key) ?? null, setItem: (key, value) => localData.set(key, value) },
  window: { dispatchEvent() {} },
  document: { cookie: '' },
  crypto: { randomUUID },
  Event: class { constructor(type) { this.type = type; } },
};
function load(filename) {
  filename = path.resolve(filename);
  if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (cache.has(filename)) return cache.get(filename);
  const exports = {};
  cache.set(filename, exports);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    ...browser,
    require(id) {
      if (id === 'react') return { useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() };
      if (id === 'server-only') return {};
      if (id === 'next/headers') return { cookies: async () => ({ get: () => undefined }) };
      const resolved = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(filename), id);
      return load(path.extname(resolved) ? resolved : resolved + '.ts');
    },
  }, { filename });
  return exports;
}
const familyModule = load(path.join(root, 'lib/family-demo.ts'));
const family = familyModule.selectFamilyData(['01_medication_shared_decision', '02_methotrexate_full_consultation']);
const parent = load(path.join(root, 'lib/demo-visits.ts'));
const { prescriptionEntries } = load(path.join(root, 'lib/prescription-entries.ts'));
const shared = new Set(['01_medication_shared_decision', '02_methotrexate_full_consultation']);
assert.equal(family.sharedVisits.length, 2);
assert.equal(parent.demoVisits.length, 5);
for (const visit of family.sharedVisits) assert.ok(shared.has(visit.conversation.sourceId));
for (const task of family.sharedActionItems) {
  assert.ok(task.visitHref.startsWith('/family-demo/visits#visit-'));
  assert.ok([...shared].some((source) => task.visitHref.endsWith(source)));
}
const medicines = prescriptionEntries(family.sharedVisits);
assert.ok(medicines.length > 0);
for (const entry of medicines) assert.ok(shared.has(entry.conversation.sourceId));
assert.ok(!medicines.some(({ medicine }) => medicine.heardAs === 'Ramipril'));
assert.ok(prescriptionEntries(parent.demoVisits).some(({ medicine }) => medicine.heardAs === 'Ramipril'));
assert.equal(prescriptionEntries([]).length, 0);
assert.equal(familyModule.familyProfile.parentName, 'Mary Doe');
const approved = familyModule.selectFamilyData(['03_prescription_refill_counseling']);
assert.equal(approved.sharedVisits.length, 1);
assert.ok(prescriptionEntries(approved.sharedVisits).some(({ medicine }) => medicine.heardAs === 'Ramipril'));
assert.equal(familyModule.selectFamilyData([]).sharedVisits.length, 0);
const { familyVoice } = load(path.join(root, 'lib/family-demo-config.ts'));
assert.equal(familyVoice('You and Dr. Smith discussed your medicine.'), 'Mary and Dr. Smith discussed Mary’s medicine.');
const requests = load(path.join(root, 'lib/visit-requests.ts'));
requests.requestVisit('03_prescription_refill_counseling', 'Blood Pressure Refill Check');
requests.requestVisit('03_prescription_refill_counseling', 'Blood Pressure Refill Check');
assert.equal(requests.useVisitRequests().length, 1);
assert.equal(requests.useVisitRequests()[0].status, 'pending');
requests.decideVisitRequest(requests.useVisitRequests()[0].id, 'approved');
assert.equal(requests.useVisitRequests()[0].status, 'approved');
assert.ok(decodeURIComponent(browser.document.cookie).includes('03_prescription_refill_counseling'));
requests.requestVisit('05_anticoagulant_medication_error', 'Blood Thinner Dose Mistake');
requests.decideVisitRequest(requests.useVisitRequests()[1].id, 'declined');
assert.equal(requests.useVisitRequests()[1].status, 'declined');
assert.ok(!decodeURIComponent(browser.document.cookie).includes('05_anticoagulant_medication_error'));
requests.requestVisit('05_anticoagulant_medication_error', 'Blood Thinner Dose Mistake');
assert.equal(requests.useVisitRequests().length, 3);
console.log('Request checks passed: pending state, duplicate prevention, approval grants, decline isolation, and re-request.');
console.log('Family checks passed: scoped visits, action items, prescriptions, empty shares, and unchanged parent records.');

const scheduling = load(path.join(root, 'lib/scheduling-help.ts'));
const followUp = 'clip:01_medication_shared_decision/followUp-3';
assert.equal(scheduling.useSchedulingHelp()[0].taskId, followUp);
assert.equal(scheduling.useSchedulingHelp()[0].status, 'requested');
scheduling.requestSchedulingHelp(followUp);
assert.equal(scheduling.useSchedulingHelp().length, 1);
scheduling.updateSchedulingHelp(followUp, 'helping');
assert.equal(scheduling.useSchedulingHelp()[0].status, 'helping');
scheduling.updateSchedulingHelp(followUp, 'handled');
assert.equal(scheduling.useSchedulingHelp()[0].status, 'handled');
scheduling.requestSchedulingHelp(followUp);
assert.equal(scheduling.useSchedulingHelp().length, 1);
assert.equal(scheduling.useSchedulingHelp()[0].status, 'requested');
scheduling.cancelSchedulingHelp(followUp);
assert.equal(scheduling.useSchedulingHelp().length, 0);
console.log('Scheduling checks passed: seeded alert, duplicate prevention, acknowledgment, resolution, re-request, and cancellation.');
