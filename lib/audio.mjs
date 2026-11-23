// Where a conversation's audio lives. A local copy in data/audio/ is preferred:
// it keeps a demo working when Pocket or the venue Wi-Fi isn't. Pocket
// recordings without a local copy fall back to a short-lived signed URL.
import { existsSync } from "node:fs";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, extname } from "node:path";
import { slugFor } from "./store.mjs";
import { createPocketClient } from "./pocket.mjs";
import { DATA_DIR } from "./datadir.mjs";

const AUDIO_DIR = join(DATA_DIR, "audio");

export const AUDIO_TYPES = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".webm": "audio/webm",
};

const EXT_FOR_TYPE = Object.fromEntries(Object.entries(AUDIO_TYPES).map(([ext, type]) => [type, ext]));
EXT_FOR_TYPE["audio/mp4"] = ".m4a";
EXT_FOR_TYPE["audio/x-wav"] = ".wav";
EXT_FOR_TYPE["audio/mp3"] = ".mp3";
EXT_FOR_TYPE["audio/x-m4a"] = ".m4a";

/** @returns {{ path: string, type: string } | null} */
export function localAudio(conversationId) {
  const base = join(AUDIO_DIR, slugFor(conversationId));
  for (const [ext, type] of Object.entries(AUDIO_TYPES)) {
    if (existsSync(base + ext)) return { path: base + ext, type };
  }
  return null;
}

export function hasAudio(conversation) {
  return Boolean(localAudio(conversation.id)) || (conversation.source === "pocket" && Boolean(process.env.POCKET_API_KEY));
}

// Signed URLs are reused until shortly before they expire.
const signedUrlCache = new Map();

export async function pocketAudioUrl(recordingId, { client } = {}) {
  const hit = signedUrlCache.get(recordingId);
  if (hit && hit.expiresAt - Date.now() > 5 * 60 * 1000) return hit.url;
  const fresh = await (client ?? createPocketClient()).getAudioUrl(recordingId);
  signedUrlCache.set(recordingId, fresh);
  return fresh.url;
}

/**
 * Saves a Pocket recording's audio to data/audio/. Returns the local path.
 * Extension comes from the response Content-Type, then the URL path, then .mp3.
 */
export async function downloadPocketAudio(conversation, { client, fetchImpl = fetch } = {}) {
  if (conversation.source !== "pocket") throw new Error("Only Pocket conversations have remote audio");
  const url = await pocketAudioUrl(conversation.sourceId, { client });
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Audio download failed: HTTP ${res.status}`);
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const urlExt = extname(new URL(url).pathname).toLowerCase();
  const ext = EXT_FOR_TYPE[type] ?? (AUDIO_TYPES[urlExt] ? urlExt : ".mp3");

  const existing = localAudio(conversation.id);
  if (existing) await rm(existing.path);
  await mkdir(AUDIO_DIR, { recursive: true });
  const path = join(AUDIO_DIR, slugFor(conversation.id) + ext);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

/** Parses a single-range "bytes=a-b" header. Returns null for absent or unsupported ranges. */
export function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? "");
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start;
  let end;
  if (m[1] === "") {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return { unsatisfiable: true };
  return { start, end };
}
