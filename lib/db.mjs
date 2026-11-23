// App state for step 3: help requests and the owner's review edits, in one JSON
// file. Writes go through a queue so concurrent server actions don't clobber
// each other. Replace with Supabase tables of the same shape later.
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { join } from "node:path";
import { DATA_DIR } from "./datadir.mjs";

const FILE = join(DATA_DIR, "app.json");
const EMPTY = { requests: [] };

// HelpRequest {
//   id, token                     token is the helper's link; it grants access to this request only
//   conversationId, followUpId
//   helperId, helperName
//   message: string               the owner's note
//   includeHeadline: boolean      whether the helper sees the one-line visit summary
//   snapshot: { title, detail, when, dueBy, headline|null }   what the helper sees, frozen at approval
//   status: "requested" | "accepted" | "done" | "declined"
//   helperNote: string|null       e.g. "Booked Dec 9, 8am, Quest on Main St"
//   history: { status, at, note }[]
//   createdAt, updatedAt
// }

async function load() {
  try {
    return { ...EMPTY, ...JSON.parse(await readFile(FILE, "utf8")) };
  } catch (err) {
    if (err.code === "ENOENT") return structuredClone(EMPTY);
    throw err;
  }
}

async function save(db) {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2));
  await rename(tmp, FILE);
}

let queue = Promise.resolve();
function mutate(fn) {
  const run = queue.then(async () => {
    const db = await load();
    const result = await fn(db);
    await save(db);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

export async function listRequests({ conversationId } = {}) {
  const { requests } = await load();
  return requests
    .filter((r) => !conversationId || r.conversationId === conversationId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getRequestByToken(token) {
  if (typeof token !== "string" || token.length < 20) return null;
  const { requests } = await load();
  return requests.find((r) => r.token === token) ?? null;
}

export function createRequest({ conversationId, followUpId, helper, message, includeHeadline, snapshot }) {
  return mutate((db) => {
    const now = new Date().toISOString();
    const req = {
      id: randomUUID(),
      token: randomBytes(18).toString("base64url"),
      conversationId,
      followUpId,
      helperId: helper.id,
      helperName: helper.name,
      message,
      includeHeadline,
      snapshot,
      status: "requested",
      helperNote: null,
      history: [{ status: "requested", at: now, note: message || null }],
      createdAt: now,
      updatedAt: now,
    };
    db.requests.push(req);
    return req;
  });
}

const TRANSITIONS = {
  requested: ["accepted", "declined"],
  accepted: ["done", "declined"],
  declined: [],
  done: [],
};

/** Moves a request forward; throws on a transition the state machine doesn't allow. */
export function updateRequestStatus(token, status, note = null) {
  return mutate((db) => {
    const req = db.requests.find((r) => r.token === token);
    if (!req) throw new Error("Request not found");
    if (!TRANSITIONS[req.status].includes(status)) {
      throw new Error(`Can't go from ${req.status} to ${status}`);
    }
    const now = new Date().toISOString();
    req.status = status;
    if (note) req.helperNote = note;
    req.history.push({ status, at: now, note });
    req.updatedAt = now;
    return req;
  });
}

export function resetAppState() {
  return mutate((db) => {
    db.requests = [];
  });
}
