// RxNorm lookups through NLM's free RxNav API (no key). Only drug-name strings
// are sent, never transcript text.
// https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html
//
// RxNorm covers U.S. drugs. A UK or Canadian brand that isn't found is
// "not in RxNorm", not "not a drug".
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "./datadir.mjs";

const BASE = "https://rxnav.nlm.nih.gov/REST";
const CACHE_FILE = join(DATA_DIR, "rxnorm-cache.json");

// NLM terms of service: at most 20 requests per second per IP, and cache
// results for 12-24 hours. https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 60; // ~16 requests per second, under the 20/s limit

let cache = null;
let dirty = false;
const inFlight = new Map();
let nextSlot = 0;

async function loadCache() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(CACHE_FILE, "utf8"));
  } catch {
    cache = {};
  }
  return cache;
}

export async function flushRxNormCache() {
  if (!dirty || !cache) return;
  await mkdir(DATA_DIR, { recursive: true });
  // Drop expired entries so the file doesn't grow without bound.
  const now = Date.now();
  for (const [k, v] of Object.entries(cache)) if (!(v?.at > now - CACHE_TTL_MS)) delete cache[k];
  await writeFile(CACHE_FILE, JSON.stringify(cache));
  dirty = false;
}

/** Waits for the next free request slot so concurrent callers stay under the limit. */
function paced() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  return new Promise((r) => setTimeout(r, wait));
}

async function getJson(path, { fetchImpl = fetch, now = Date.now } = {}) {
  const c = await loadCache();
  const hit = c[path];
  if (hit?.at > now() - CACHE_TTL_MS) return hit.body;
  // Identical lookups that overlap share one request.
  if (inFlight.has(path)) return inFlight.get(path);
  const req = (async () => {
    await paced();
    const res = await fetchImpl(BASE + path, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`RxNav ${res.status} for ${path}`);
    const body = await res.json();
    c[path] = { at: now(), body };
    dirty = true;
    return body;
  })();
  inFlight.set(path, req);
  try {
    return await req;
  } finally {
    inFlight.delete(path);
  }
}

/** Test hook: forget the in-memory cache and pacing state. */
export function _resetRxNormForTests() {
  cache = {};
  dirty = false;
  inFlight.clear();
  nextSlot = 0;
}

const q = encodeURIComponent;

/** Concept details for an RxCUI: { rxcui, name, tty } or null. */
export async function properties(rxcui, opts) {
  const body = await getJson(`/rxcui/${q(rxcui)}/properties.json`, opts);
  const p = body?.properties;
  return p ? { rxcui: p.rxcui, name: p.name, tty: p.tty } : null;
}

/**
 * Exact or normalized match (case and spacing differences allowed).
 * @returns {Promise<{ rxcui, name, tty } | null>}
 */
export async function exactMatch(name, opts) {
  const term = String(name ?? "").trim();
  if (!term) return null;
  const body = await getJson(`/rxcui.json?name=${q(term)}&search=2`, opts);
  const id = body?.idGroup?.rxnormId?.[0];
  return id ? properties(id, opts) : null;
}

/**
 * Lexically similar concepts for a possibly misspelled name. Scores measure
 * spelling similarity only, not how likely the drug is to be the one spoken.
 * @returns {Promise<{ rxcui, name, tty, score }[]>} distinct concepts, best first
 */
export async function approximateMatches(name, { max = 4, ...opts } = {}) {
  const term = String(name ?? "").trim();
  if (!term) return [];
  const body = await getJson(`/approximateTerm.json?term=${q(term)}&maxEntries=${max * 3}&option=1`, opts);
  const seen = new Map();
  for (const c of body?.approximateGroup?.candidate ?? []) {
    if (!c.rxcui || seen.has(c.rxcui)) continue;
    seen.set(c.rxcui, Number(c.score) || 0);
  }
  const top = [...seen.entries()].slice(0, max);
  const out = [];
  for (const [rxcui, score] of top) {
    const p = await properties(rxcui, opts);
    if (p) out.push({ ...p, score });
  }
  return out;
}

/**
 * Ingredient RxCUIs for a concept: a brand (Risperdal) gives its ingredient
 * (risperidone); an ingredient gives itself. Used to treat a brand and its
 * generic as the same drug.
 * @returns {Promise<string[]>}
 */
export async function ingredients(rxcui, opts) {
  const body = await getJson(`/rxcui/${q(rxcui)}/related.json?tty=IN+MIN`, opts);
  return (body?.relatedGroup?.conceptGroup ?? []).flatMap((g) => (g.conceptProperties ?? []).map((c) => c.rxcui));
}
