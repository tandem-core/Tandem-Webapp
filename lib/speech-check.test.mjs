// node --test lib/speech-check.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { missingWords, speechHints } from "./speech-check.mjs";

const said = "Your doctor started you on methotrexate, 15 milligrams, once a week on Mondays.";

test("accepts the same words written differently", () => {
  assert.deepEqual(missingWords(said, "Your Dr. started you on methotrexate 15 mg once a week on Monday."), []);
  assert.deepEqual(missingWords("Take two tablets at 8:00 a.m. on March 3rd.", "Take 2 tablets at 8 AM on March 3."), []);
  assert.deepEqual(missingWords("It sounded like Lenzaprazole.", "It sounded like lansoprazole."), []);
  assert.deepEqual(missingWords("No more than 3,000 milligrams a day.", "No more than 3000 mg a day."), []);
  assert.deepEqual(missingWords("Take 1,000 IU a day.", "Take one thousand IU a day."), []);
});

test("catches a skipped or changed dose, timing or negation", () => {
  assert.deepEqual(missingWords(said, "Your doctor started you on methotrexate once a week on Mondays."), ["15", "mg"]);
  assert.deepEqual(missingWords(said, "Your doctor started you on methotrexate, 50 milligrams, once a week on Mondays."), ["15"]);
  assert.deepEqual(missingWords(said, "Your doctor started you on methotrexate, 15 milligrams, twice a week on Mondays."), ["once"]);
  assert.deepEqual(missingWords("Don't stop taking it.", "Do stop taking it."), ["not"]);
  assert.deepEqual(missingWords(said, "Your doctor started you on 15 milligrams once a week on Mondays."), ["methotrexate"]);
});

test("hints are the long words", () => {
  assert.deepEqual(speechHints(said), ["started", "methotrexate"]);
});
