import assert from 'node:assert/strict';
import test from 'node:test';

import { aboutMary, answerOf, brief, clock, doseOf, isNewForLisa, amountOf, homeLine, labelChecks, otherChecks, shortDate } from './format.ts';

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
  const spoken = { actions: [{ type: 'speak', text: "From your Tuesday, November 3 recording. Take 15 mg daily. Here's what was said." }], result: { status: 'answered' } };
  assert.equal(answerOf(spoken), 'November 3: Take 15 mg daily.');
  const offer = {
    actions: [
      { type: 'speak', text: "From your Tuesday, November 3 recording. Book in a month. Here's what was said." },
      { type: 'speak', text: 'Would you like me to ask Lisa to help with this? Hold the button and say yes or no.' },
    ],
    result: { status: 'answered' },
  };
  assert.equal(answerOf(offer), 'November 3: Book in a month. Would you like me to ask Lisa to help with this?');
  const dated = { actions: [{ type: 'speak', text: 'From your Tuesday, November 3 recording. On November 3, you agreed to 15 mg.' }], result: { status: 'answered' } };
  assert.equal(answerOf(dated), 'On November 3, you agreed to 15 mg.');
  const many = { actions: [{ type: 'speak', text: 'From your recordings. Take 10 mg.' }], result: { status: 'answered' } };
  assert.equal(answerOf(many), 'Take 10 mg.');
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

test('brief hides only a tail with no numbers, quotes or medicine names', () => {
  const headline = "You and Dr. Smith agreed to lower your heartburn medicine (the one that sounded like 'Lenzaprazole') from 30 mg to 15 mg daily for two weeks, instead of stopping it right away.";
  assert.deepEqual(brief(headline), {
    short: "You and Dr. Smith agreed to lower your heartburn medicine (the one that sounded like 'Lenzaprazole') from 30 mg to 15 mg daily for two weeks.",
    rest: 'instead of stopping it right away.',
  });
  assert.equal(brief('Take it daily. Stop if you feel dizzy. Call about the 2 pm test.').rest, '');
  assert.equal(brief('Keep taking it as before, and avoid ibuprofen for now.', ['ibuprofen']).rest, '');
  assert.equal(brief('Keep taking your blood pressure pills, and rest well this week.').short, 'Keep taking your blood pressure pills.');
});

test('shortDate stays short', () => {
  assert.equal(shortDate('2026-11-03T15:00:00Z'), 'Nov 3');
});

test('homeLine shows one short line and never cuts a dose', () => {
  const med = { heardAs: 'Lenzaprazole', role: 'changed', suggestion: { name: 'lansoprazole' }, nameResolved: false, doseStatements: [{ text: '15 milligram daily', unclear: false }] };
  const long = 'You and Dr. Smith agreed to lower your heartburn medicine from 30 mg to 15 mg daily for two weeks.';
  assert.equal(homeLine({ headline: long, medications: [med], followUps: [] }), '“Lenzaprazole” 15 mg');
  assert.equal(homeLine({ headline: 'Blood pressure is steady, keep going as you are.', medications: [], followUps: [] }), 'Blood pressure is steady, keep going as you are.');
  assert.equal(homeLine({ headline: long, medications: [], followUps: [{ title: 'Book a follow-up' }] }), 'Book a follow-up');
});

test('amountOf keeps thousands whole', () => {
  assert.equal(amountOf('no more than 3,000 milligrams in a day'), '3,000 mg');
  assert.equal(amountOf('100 my grams'), null);
});
