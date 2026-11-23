// Picks what of the original recording to play after an answer.
//
// Each piece of support is a transcript line plus the exact words in it that
// back the claim. The clip is built around those words, not around whole
// caption lines: caption lines are cut for subtitles, not meaning, and often
// hold the end of one topic and the start of the next ("…blood test to check
// that first. Okay. … we're going to send you for a chest x-ray"). Line-level
// clips played the neighbouring topic, and could drop the most important line
// when its widened span ran long.
//
// Rules:
// - A quote that isn't in the transcript is ignored: never play what can't be
//   located.
// - The clip covers the whole sentence the quote sits in, worked out word by
//   word; a sentence that runs very long shrinks to the quote itself.
// - The top-ranked quote is always played.
// - Nearby clips merge, so audio is never repeated at a join.

const ENDS_SENTENCE = /(?<!\b(?:Dr|Mr|Mrs|Ms|St|Prof))[.?!]["')\]]?$/;
const MAX_SENTENCE_WORDS = 40; // how far to look for a sentence edge
const MAX_EXCERPT_SECONDS = 18; // a longer sentence shrinks to its quote
const QUOTE_MARGIN_WORDS = 2;
const MERGE_GAP_SECONDS = 1.5;
const MAX_MERGED_SECONDS = 25;

const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Every word with its line and character position, for word-level timing. */
function wordIndex(segs) {
  const words = [];
  segs.forEach((seg, line) => {
    for (const m of seg.text.matchAll(/\S+/g)) words.push({ line, i0: m.index, i1: m.index + m[0].length, raw: m[0], n: norm(m[0]) });
  });
  return words;
}

// Caption lines carry no per-word times, so a word's time is estimated from
// its position in the line's text. Within a second or so; the clip's lead-in
// and fades cover the rest. Deepgram lines are short, so the estimate is tight.
function timeAt(segs, w, edge) {
  const seg = segs[w.line];
  const frac = (edge === "start" ? w.i0 : w.i1) / Math.max(1, seg.text.length);
  return seg.start + (seg.end - seg.start) * frac;
}

/** Word range [a, b] where the quote appears, searching near its line first. */
export function locateQuote(words, line, quote) {
  if (!quote) {
    const inLine = words.map((w, i) => (w.line === line ? i : -1)).filter((i) => i >= 0);
    return inLine.length ? { a: inLine[0], b: inLine.at(-1) } : null;
  }
  const q = quote.split(/\s+/).map(norm).filter(Boolean);
  if (!q.length) return null;
  const near = (w) => w.line >= line - 1 && w.line <= line + 2;
  // Exact first; then trimmed by a word or two at each end, in case the model
  // paraphrased an edge. Never fewer than 3 words: too short to be evidence.
  for (let trim = 0; q.length - 2 * trim >= Math.min(3, q.length); trim++) {
    const part = q.slice(trim, q.length - trim);
    for (const scope of [near, () => true]) {
      const hit = findSequence(words, part, scope, line);
      if (hit) return hit;
    }
  }
  return null;
}

function findSequence(words, part, scope, line) {
  const idx = words.map((w, i) => (w.n && scope(w) ? i : -1)).filter((i) => i >= 0);
  let best = null;
  for (let s = 0; s + part.length <= idx.length; s++) {
    let ok = true;
    for (let k = 0; k < part.length && ok; k++) ok = words[idx[s + k]].n === part[k];
    if (!ok) continue;
    const hit = { a: idx[s], b: idx[s + part.length - 1] };
    // Several matches: take the one nearest the cited line.
    if (!best || Math.abs(words[hit.a].line - line) < Math.abs(words[best.a].line - line)) best = hit;
  }
  return best;
}

// A sentence opening with one of these leans on the one before ("So, we will
// do a blood test to check that first" needs "it can affect your liver").
// "And", "but" and "also" are left out: clinicians open new topics with them
// ("And as we increase the dose..." after a sentence about a chest x-ray).
const LEANS_BACK = new Set(["so", "that", "this", "it", "then", "because", "which"]);
const FILLER = /^(okay|ok|yeah|yes|right|mhm|mm|um|uh)[.,!?]*$/i;
const BACKCHANNEL = new Set(["okay", "ok", "yeah", "yes", "right", "mhm", "mm", "um", "uh", "i", "see", "sure", "alright", "great", "fine", "thanks", "thank", "you"]);

const sentenceStart = (words, from) => {
  let s = from;
  while (s > 0 && from - s < MAX_SENTENCE_WORDS && !ENDS_SENTENCE.test(words[s - 1].raw)) s--;
  return s;
};

/** The sentence around a word range, or the range plus a margin if that's too long. */
function sentenceAround(words, segs, { a, b }) {
  const secs = (x, y) => timeAt(segs, words[y], "end") - timeAt(segs, words[x], "start");
  let s = sentenceStart(words, a);
  let e = b;
  while (e < words.length - 1 && e - b < MAX_SENTENCE_WORDS && !ENDS_SENTENCE.test(words[e].raw)) e++;
  if (secs(s, e) > MAX_EXCERPT_SECONDS) {
    return { a: Math.max(0, a - QUOTE_MARGIN_WORDS), b: Math.min(words.length - 1, b + QUOTE_MARGIN_WORDS) };
  }
  // Take in the previous sentence when this one leans on it, skipping a lone
  // "Okay." in between, if the clip stays short.
  if (s > 0 && LEANS_BACK.has(words[s].n)) {
    let p = s;
    while (p > 0 && FILLER.test(words[p - 1].raw)) p--;
    const prev = p > 0 ? sentenceStart(words, p - 1) : s;
    // Only a sentence with content: "I see." or "Yeah, sure." adds nothing.
    const hasContent = words.slice(prev, p).some((w) => w.n && !BACKCHANNEL.has(w.n));
    if (prev < s && hasContent && secs(prev, e) <= MAX_EXCERPT_SECONDS) s = prev;
  }
  return { a: s, b: e };
}

/**
 * @param {{ segments: { start, end, text, speakerName?, speaker }[] }} conversation
 * @param {({ line: number, quote: string } | number)[]} support  most important first;
 *   a bare line number means "the whole line" (no quote to anchor on)
 * @param {object} [opts]
 * @param {number} [opts.maxExcerpts]  separate excerpts to play
 * @param {number} [opts.maxSeconds]   total playback budget (the first excerpt always plays)
 * @returns {{ idx, lines: number[], start, end, text, speaker, quote }[]} most important first
 */
export function buildExcerpts(conversation, support, { maxExcerpts = 2, maxSeconds = 30 } = {}) {
  const segs = conversation.segments;
  const words = wordIndex(segs);
  const t0 = (sp) => timeAt(segs, words[sp.a], "start");
  const t1 = (sp) => timeAt(segs, words[sp.b], "end");
  const spans = []; // { a, b, quote }: word ranges, most important first
  const total = () => spans.reduce((n, sp) => n + t1(sp) - t0(sp), 0);
  const gapSeconds = (x, y) => {
    const [first, second] = x.a <= y.a ? [x, y] : [y, x];
    return t0(second) - t1(first);
  };

  for (const item of support ?? []) {
    const { line, quote } = typeof item === "number" ? { line: item, quote: null } : item;
    if (!segs[line]) continue;
    const at = locateQuote(words, line, quote);
    if (!at) continue; // can't find the words: don't play something unproven
    const span = { ...sentenceAround(words, segs, at), quote: quote ?? null };

    const near = spans.find((sp) => (span.a <= sp.b + 1 && span.b >= sp.a - 1) || gapSeconds(sp, span) <= MERGE_GAP_SECONDS);
    if (near) {
      const merged = { a: Math.min(near.a, span.a), b: Math.max(near.b, span.b) };
      if (t1(merged) - t0(merged) <= MAX_MERGED_SECONDS) Object.assign(near, merged);
      continue;
    }
    if (spans.length && (spans.length >= maxExcerpts || total() + t1(span) - t0(span) > maxSeconds)) continue;
    spans.push(span);
  }

  return spans.map((sp) => {
    const lines = [...new Set(words.slice(sp.a, sp.b + 1).map((w) => w.line))];
    const first = segs[lines[0]];
    return {
      idx: lines[0],
      lines,
      start: t0(sp),
      end: t1(sp),
      text: words.slice(sp.a, sp.b + 1).map((w) => w.raw).join(" "),
      speaker: first.speakerName ?? first.speaker,
      quote: sp.quote,
    };
  });
}
