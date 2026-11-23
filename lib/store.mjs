// File-backed store for step 1. Swap for Supabase once the web app exists; keep
// the same function names so callers don't change.
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "./datadir.mjs";

function safe(id) {
  return id.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

export async function saveConversation(conversation) {
  const dir = join(DATA_DIR, "conversations");
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${safe(conversation.id)}.json`);
  await writeFile(path, JSON.stringify(conversation, null, 2));
  return path;
}

export async function saveRaw(kind, id, body) {
  const dir = join(DATA_DIR, "raw", kind);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${safe(id)}.json`);
  await writeFile(path, JSON.stringify(body, null, 2));
  return path;
}

export async function listConversations() {
  const dir = join(DATA_DIR, "conversations");
  const files = await readdir(dir).catch(() => []);
  return Promise.all(
    files.filter((f) => f.endsWith(".json")).map(async (f) => JSON.parse(await readFile(join(dir, f), "utf8"))),
  );
}

export async function loadConversation(id) {
  const path = join(DATA_DIR, "conversations", `${safe(id)}.json`);
  return JSON.parse(await readFile(path, "utf8"));
}

export async function saveRecap(recap) {
  const dir = join(DATA_DIR, "recaps");
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${safe(recap.conversationId)}.json`);
  await writeFile(path, JSON.stringify(recap, null, 2));
  return path;
}

export async function loadRecap(conversationId) {
  const path = join(DATA_DIR, "recaps", `${safe(conversationId)}.json`);
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

export async function saveMedications(review) {
  const dir = join(DATA_DIR, "medications");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${safe(review.conversationId)}.json`), JSON.stringify(review, null, 2));
}

export async function loadMedications(conversationId) {
  try {
    return JSON.parse(await readFile(join(DATA_DIR, "medications", `${safe(conversationId)}.json`), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

/** URL-safe key for a conversation id ("fixture:doctor-visit" -> "fixture_doctor-visit"). */
export const slugFor = (conversationId) => safe(conversationId);

/** Conversations with their recaps, newest recording first. */
export async function listVisits() {
  const conversations = await listConversations();
  const visits = await Promise.all(
    conversations.map(async (c) => ({
      slug: slugFor(c.id),
      conversation: c,
      recap: await loadRecap(c.id),
      medications: await loadMedications(c.id),
    })),
  );
  return visits.sort((a, b) => String(b.conversation.recordedAt).localeCompare(String(a.conversation.recordedAt)));
}

export async function getVisit(slug) {
  return (await listVisits()).find((v) => v.slug === slug) ?? null;
}

/** Returns true the first time a key is seen, false on repeats. */
export async function markDeliverySeen(key) {
  const path = join(DATA_DIR, "seen-deliveries.json");
  await mkdir(DATA_DIR, { recursive: true });
  const seen = new Set(JSON.parse(await readFile(path, "utf8").catch(() => "[]")));
  if (seen.has(key)) return false;
  seen.add(key);
  await writeFile(path, JSON.stringify([...seen]));
  return true;
}
