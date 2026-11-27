// Testing track only. Checks that generated speech said every word that matters:
// numbers, units, how often, dates, times, negations, and long words such as
// medicine names. Speech models can skip words ("15 milligrams" went missing in
// testing), and a skipped dose is worse than no audio.

const NUMBERS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 };
const EXACT = new Set(
  "mg mcg ml unit tablet pill puff drop once twice daily weekly monthly morning evening night bedtime hour day week month year am pm not no never before after half quarter january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday".split(" "),
);

function tokens(text) {
  return String(text)
    .toLowerCase()
    .replace(/n['’]t\b/g, " not")
    .replace(/\b(\d+):00\b/g, "$1")
    .replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1")
    .replace(/\ba\.m\./g, "am")
    .replace(/\bp\.m\./g, "pm")
    .replace(/\bmilligrams?\b/g, "mg")
    .replace(/\bmicrograms?\b/g, "mcg")
    .replace(/\bmillilit(?:er|re)s?\b/g, "ml")
    .split(/[^a-z0-9.]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean)
    .map((t) => (t in NUMBERS ? String(NUMBERS[t]) : t))
    .map((t) => (EXACT.has(t.replace(/s$/, "")) ? t.replace(/s$/, "") : t));
}

const isExact = (t) => /^\d/.test(t) || EXACT.has(t);
const isLong = (t) => t.length >= 7 && !isExact(t);

function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Long words of the text, to pass to transcription as hints. */
export const speechHints = (text) => [...new Set(tokens(text).filter(isLong))];

/**
 * Words from `text` that matter but aren't in `heard` (a transcript of the audio).
 * Numbers, units and dates must match exactly and as often; long words within a
 * few letters, since transcription may spell an unusual name differently.
 * @returns {string[]} empty when the audio said everything that matters
 */
export function missingWords(text, heard) {
  const have = tokens(heard);
  const counts = new Map();
  for (const t of have) counts.set(t, (counts.get(t) ?? 0) + 1);
  const missing = [];
  for (const t of tokens(text)) {
    if (isExact(t)) {
      if (counts.get(t)) counts.set(t, counts.get(t) - 1);
      else missing.push(t);
    } else if (isLong(t) && !have.some((h) => distance(t, h) <= Math.max(1, Math.floor(t.length * 0.25)))) {
      missing.push(t);
    }
  }
  return missing;
}
