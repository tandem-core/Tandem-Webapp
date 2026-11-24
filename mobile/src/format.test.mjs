import assert from 'node:assert/strict';
import test from 'node:test';

import { clock, doseOf, labelChecks, markerPositions, otherChecks } from './format.ts';

const med = (overrides) => ({
  id: 'med-1',
  role: 'changed',
  needsReview: true,
  suggestion: { name: 'lansoprazole' },
  doseStatements: [],
  ...overrides,
});

test('doseOf uses the last clear amount', () => {
  const statements = [
    { text: '30 milligrams daily', unclear: false },
    { text: '15 milligram daily for two weeks', unclear: false },
    { text: '100 my grams', unclear: true },
  ];
  assert.equal(doseOf(med({ doseStatements: statements })), '15 mg');
  assert.equal(doseOf(med({ doseStatements: [{ text: 'once a week', unclear: false }] })), null);
});

test('labelChecks skips medicines only mentioned, turned down, or without a suggested name', () => {
  const visit = {
    medications: [
      med({ id: 'a' }),
      med({ id: 'b', role: 'not_chosen' }),
      med({ id: 'c', role: 'discussed' }),
      med({ id: 'd', suggestion: null }),
      med({ id: 'e', needsReview: false }),
    ],
  };
  assert.deepEqual(labelChecks(visit).map((m) => m.id), ['a']);
  // Medicines without a suggested name still need a check if Mary takes them.
  assert.deepEqual(otherChecks(visit).map((m) => m.id), ['d']);
});

test('clock formats seconds as m:ss', () => {
  assert.equal(clock(95.7), '1:35');
  assert.equal(clock(-3), '0:00');
});

test('markerPositions keeps close moments apart', () => {
  assert.deepEqual(markerPositions([10, 150, 155], 300), [10 / 3, 50, 58]);
  assert.deepEqual(markerPositions([290, 299], 300), [92, 100]);
});
