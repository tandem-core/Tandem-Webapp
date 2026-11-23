// Checks one Remember result against a question from fixtures/remember-questions.json.
const lc = (x) => String(x ?? "").toLowerCase();

export function gradeRemember(result, expected) {
  const checks = [];
  const add = (name, pass, note = "") => checks.push({ name, pass: Boolean(pass), note });
  const text = lc(result.speech);

  add("picked the right visit", (result.visit?.slug ?? null) === expected.visit, `got ${result.visit?.slug ?? "none"}`);
  add("status", expected.status.includes(result.status), `got ${result.status}`);
  if (expected.choices) {
    const offered = (result.options ?? []).map((o) => o.slug);
    add("offers only visits that discuss it", offered.length > 1 && offered.every((s) => expected.choices.includes(s)), offered.join(", "));
  }
  for (const term of expected.mustMention ?? []) {
    add(`mentions ${term}`, term.split("|").some((t) => text.includes(lc(t))));
  }
  for (const term of expected.mustNotMention ?? []) {
    add(`doesn't say ${term}`, !text.includes(lc(term)));
  }
  if (["answered", "partly_answered"].includes(result.status)) {
    add("plays the doctor's words", result.clips.length > 0 && result.audioUrl);
  }
  // What the doctor is heard saying must back the answer: the clip text, not
  // just that some clip played (a clip about a chest x-ray once followed an
  // answer about a liver blood test).
  const clipText = lc(result.clips.map((c) => c.text).join(" "));
  const heard = result.clips.map((c) => c.text).join(" / ").slice(0, 200);
  for (const term of expected.clipMustMention ?? []) {
    add(`clip says ${term}`, term.split("|").some((t) => clipText.includes(lc(t))), heard);
  }
  for (const term of expected.clipMustNotMention ?? []) {
    add(`clip doesn't say ${term}`, !clipText.includes(lc(term)), heard);
  }
  add("no gendered pronoun", !/\b(she|he|her|hers|him|his)\b/.test(text), result.speech);
  add("no line numbers read aloud", !/\blines? \d/.test(text));
  const words = lc(result.answer).split(/\s+/).filter(Boolean).length;
  add("short enough to hear (≤ 60 words)", words <= 60, `${words} words`);
  return checks;
}
