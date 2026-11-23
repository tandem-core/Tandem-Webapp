// Answers that worked, kept so a demo survives losing the internet. Claude and
// Deepgram are cloud services; the clips and any speech already generated are
// on this machine. A question rehearsed once online can be replayed offline:
// automatically when a live turn fails, or from the backup list on /device.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { cachedAudio } from "./tts.mjs";
import { DATA_DIR } from "./datadir.mjs";

const FILE = join(DATA_DIR, "voice-cache.json");
const MAX_ENTRIES = 40;

export const normalizeQuestion = (q) =>
  String(q ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

async function load() {
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

export async function rememberTurn(heard, actions) {
  const key = normalizeQuestion(heard);
  if (!key) return;
  const entries = (await load()).filter((e) => e.key !== key);
  entries.unshift({ key, heard, actions, at: new Date().toISOString() });
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(entries.slice(0, MAX_ENTRIES), null, 2));
}

// Words that say little about which answer is meant.
const FILLER = new Set("the they did does what when how about say said tell told need get got supposed my me you your and for with this that was were are is was can could should would will doctor doctors".split(" "));
const contentWords = (q) => new Set(normalizeQuestion(q).split(" ").filter((w) => w.length > 2 && !FILLER.has(w)));

/**
 * Closest saved answer by shared content words ("did they change my blood
 * pressure pill" finds "did the doctor change my blood pressure medication").
 * Strict on purpose: offline, a wrong saved answer is worse than none.
 */
export async function findCachedTurn(heard) {
  const words = contentWords(heard);
  if (!words.size) return null;
  let best = null;
  for (const e of await load()) {
    const other = contentWords(e.key);
    const shared = [...words].filter((w) => other.has(w)).length;
    const score = shared / Math.max(words.size, other.size);
    if (!best || score > best.score) best = { entry: e, score };
  }
  return best && best.score >= 0.6 ? best.entry : null;
}

/** Entries with whether their speech is already on disk (playable offline). */
export async function listCachedTurns() {
  return (await load()).map((e) => {
    const speech = e.actions.filter((a) => a.type === "speak" && a.url);
    const ready = speech.every((a) => cachedAudio(a.url.split("/").pop()));
    return { heard: e.heard, at: e.at, actions: e.actions, offlineReady: ready };
  });
}
