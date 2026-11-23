// SRT subtitle parsing and clipping, for Whisper transcripts of test recordings.

export function parseTimestamp(ts) {
  const m = /^(\d+):(\d{2}):(\d{2})[.,](\d{1,3})$/.exec(String(ts).trim());
  if (!m) throw new Error(`Bad timestamp: ${ts}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0")) / 1000;
}

/** @returns {{ start: number, end: number, text: string }[]} */
export function parseSrt(text) {
  const cues = [];
  for (const block of text.replace(/^﻿/, "").replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = block.trim().split("\n");
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, b] = lines[i].split("-->").map((s) => s.trim());
    const body = lines.slice(i + 1).join(" ").trim();
    if (body) cues.push({ start: parseTimestamp(a), end: parseTimestamp(b), text: body });
  }
  return cues;
}

/**
 * Cues whose midpoint falls inside [start, end), shifted so `start` becomes 0.
 * Using the midpoint avoids keeping a cue that is mostly outside the cut.
 */
export function clipCues(cues, start, end = Infinity) {
  return cues
    .filter((c) => {
      const mid = (c.start + c.end) / 2;
      return mid >= start && mid < end;
    })
    .map((c) => ({
      start: Math.max(0, c.start - start),
      end: Math.min(end, c.end) - start,
      text: c.text,
    }));
}

/** Minimal CSV parser: quoted fields, doubled quotes, commas inside quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  const [header, ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ""])));
}
