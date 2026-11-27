import assert from 'node:assert/strict';
import test from 'node:test';

import { aboutMary, answerOf, clock, doseOf, isNewForLisa, labelChecks, markerPositions, otherChecks } from './format.ts';

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

test('answerOf replaces the misleading offline line but keeps real and saved answers', () => {
  const offline = { actions: [{ type: 'speak', text: "I can't reach Tandem right now. Please check the internet connection." }], result: null, fromCache: false };
  assert.equal(answerOf(offline), 'Answers aren’t available right now.');
  const saved = { actions: [{ type: 'speak', text: 'Saved.' }, { type: 'speak', text: 'Take 15 mg.' }], result: null, fromCache: true };
  assert.equal(answerOf(saved), 'Saved. Take 15 mg.');
  const live = { actions: [{ type: 'speak', text: 'Take 15 mg.' }, { type: 'play', text: 'quote' }, { type: 'listen' }], result: { status: 'answered' } };
  assert.equal(answerOf(live), 'Take 15 mg.');
});

test('isNewForLisa flags appointments recorded after sharing began, until Lisa opens them', () => {
  const since = '2026-11-27T19:00:00.000Z';
  const fresh = { slug: 'new', recordedAt: '2026-11-27T19:05:00.000Z' };
  assert.equal(isNewForLisa(fresh, since, []), true);
  assert.equal(isNewForLisa(fresh, since, ['new']), false);
  assert.equal(isNewForLisa({ slug: 'old', recordedAt: '2026-11-03T15:00:00.000Z' }, since, []), false);
  assert.equal(isNewForLisa(fresh, null, []), false);
});

test('aboutMary rewords a summary for Lisa', () => {
  assert.equal(aboutMary('You and Dr. Smith agreed to lower your dose. You were told you have arthritis.'), 'Mary and Dr. Smith agreed to lower Mary’s dose. Mary was told Mary has arthritis.');
});

test('clock formats seconds as m:ss', () => {
  assert.equal(clock(95.7), '1:35');
  assert.equal(clock(-3), '0:00');
});

test('markerPositions keeps close moments apart', () => {
  assert.deepEqual(markerPositions([10, 150, 155], 300), [10 / 3, 50, 58]);
  assert.deepEqual(markerPositions([290, 299], 300), [92, 100]);
});
