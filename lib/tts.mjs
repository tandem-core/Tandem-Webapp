// Server-side speech, so every device (Raspberry Pi, phone, browser) says the
// same thing in the same voice. Deepgram Aura-2 on the same key as
// transcription; $0.030 per 1,000 characters (deepgram.com/pricing, Nov 2026).
//
// Latency: generating a full answer takes ~6 s, longer than the rest of a turn
// combined. So a turn only *registers* the text and returns a URL; the audio
// is generated when a device fetches that URL and streamed through while
// Deepgram is still producing it (MP3, which plays while downloading). Output
// is cached by text and voice in data/tts/, so repeated phrases are instant.
// Without DEEPGRAM_API_KEY nothing is registered and devices speak the text
// themselves.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile, rename, readFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "./datadir.mjs";

const TTS_DIR = join(DATA_DIR, "tts");
const MAX_CHARS = 1900; // Aura's limit is 2,000

export const VOICE = process.env.TANDEM_TTS_VOICE ?? "aura-2-thalia-en";

/** Fixed phrases a device can download once and play without waiting. */
export const PHRASES = {
  ack: "Let me check what the doctor said.",
  replay: "Here it is again.",
  didnt_catch: "Sorry, I didn't catch that. Hold the button and ask again.",
  hint: "Hold the button and ask me what the doctor said.",
  nothing_to_replay: "There's nothing to play yet. Hold the button and ask a question.",
  error: "Sorry, something went wrong. Please try again in a moment.",
  offline: "I can't reach Tandem right now. Please check the internet connection.",
  offline_saved: "I can't reach the internet right now, so here's the answer I found earlier.",
  cancelled: "Okay, I won't.",
};

export const ttsAvailable = (env = process.env) => Boolean(env.DEEPGRAM_API_KEY || env.OPENAI_API_KEY);
export const ttsId = (text, voice = VOICE) => createHash("sha1").update(`${voice}\n${text}`).digest("hex").slice(0, 20);
const audioPath = (id) => join(TTS_DIR, `${id}.mp3`);
const textPath = (id) => join(TTS_DIR, `${id}.json`);
const clean = (text) => speakable(String(text ?? "").replace(/\s+/g, " ").trim()).slice(0, MAX_CHARS);

/**
 * Rewrites abbreviations the voice reads wrongly ("Dr. Smith" came out as
 * "drive Smith"). Only the spoken text changes; the displayed answer keeps
 * the original wording.
 */
export function speakable(text) {
  return text
    .replace(/\bDr\.?\s+(?=[A-Z])/g, "Doctor ")
    .replace(/\b(\d+(?:\.\d+)?)\s?mg\b/gi, "$1 milligrams")
    .replace(/\b(\d+(?:\.\d+)?)\s?mcg\b/gi, "$1 micrograms")
    .replace(/\bA&E\b/g, "A and E");
}

/**
 * Registers text for speech and returns its id, without generating audio yet.
 * @returns {Promise<string|null>} id, or null when no TTS service is configured
 */
export async function registerSpeech(text, { voice = VOICE, env = process.env } = {}) {
  const t = clean(text);
  if (!t || !ttsAvailable(env)) return null;
  const id = ttsId(t, voice);
  if (!existsSync(textPath(id))) {
    await mkdir(TTS_DIR, { recursive: true });
    await writeFile(textPath(id), JSON.stringify({ text: t, voice }));
  }
  return id;
}

/**
 * Registers text and returns the URL a device fetches to hear it, or null when
 * TTS is off. The URL carries the text, because on Vercel the request for the
 * audio can reach a different server instance from the one that registered it.
 */
export async function speechUrl(text, opts) {
  const id = await registerSpeech(text, opts).catch(() => null);
  return id ? `/api/voice/tts/${id}?t=${encodeURIComponent(clean(text))}` : null;
}

export function cachedAudio(id) {
  const p = audioPath(id);
  return existsSync(p) ? p : null;
}

export async function registeredText(id) {
  try {
    return JSON.parse(await readFile(textPath(id), "utf8"));
  } catch {
    return null;
  }
}

/**
 * Starts generation and returns a stream of MP3 bytes for the caller, saving
 * the complete file to the cache as it arrives.
 * @returns {Promise<ReadableStream<Uint8Array>>}
 */
export async function streamSpeech(id, { fetchImpl = fetch, env = process.env } = {}) {
  const reg = await registeredText(id);
  if (!reg) throw new Error(`Unknown speech id ${id}`);

  let res;
  if (env.DEEPGRAM_API_KEY) {
    const url = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(reg.voice)}&encoding=mp3`;
    res = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Token ${env.DEEPGRAM_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: reg.text }),
    });
    if (!res.ok || !res.body) throw new Error(`Deepgram speak ${res.status}: ${(await res.text()).slice(0, 200)}`);
  } else if (env.OPENAI_API_KEY) {
    res = await fetchImpl("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tts-1", voice: "alloy", input: reg.text, response_format: "mp3" }),
    });
    if (!res.ok || !res.body) throw new Error(`OpenAI speak ${res.status}: ${(await res.text()).slice(0, 200)}`);
  } else {
    throw new Error("No speech synthesis service configured. Set DEEPGRAM_API_KEY or OPENAI_API_KEY.");
  }

  const [toClient, toCache] = res.body.tee();
  (async () => {
    const chunks = [];
    for await (const chunk of toCache) chunks.push(chunk);
    const tmp = `${audioPath(id)}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, Buffer.concat(chunks));
    await rename(tmp, audioPath(id));
  })().catch((err) => console.error("tts cache write failed", err.message));
  return toClient;
}

/** Generates (if needed) and returns the cached file path. For pre-warming fixed phrases. */
export async function synthesize(text, opts) {
  const id = await registerSpeech(text, opts);
  if (!id) return null;
  if (!cachedAudio(id)) {
    const reader = (await streamSpeech(id, opts)).getReader();
    while (!(await reader.read()).done);
    for (let i = 0; i < 50 && !cachedAudio(id); i++) await new Promise((r) => setTimeout(r, 20));
  }
  return { id, path: audioPath(id) };
}
