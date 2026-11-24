// GET /api/voice/tts/<id>: speech registered by a voice turn (lib/tts.mjs).
// Served from cache when it exists; otherwise generated now and streamed, so
// playback can start before the whole answer has been synthesized.
import { readFile } from "node:fs/promises";
import { cachedAudio, streamSpeech, registerSpeech } from "../../../../../lib/tts.mjs";


const headers = (extra = {}) => ({
  "Content-Type": "audio/mpeg",
  "Access-Control-Allow-Origin": process.env.NODE_ENV === "production" ? "" : "*",
  ...extra,
});

export async function GET(request, { params }) {
  const { id } = await params;
  if (!/^[a-f0-9]{20}$/.test(id)) return new Response("Bad id", { status: 400 });
  // ?t= is the text itself, for a server instance that didn't register it.
  // Text is stored under its own hash, so other text can't play under this id.
  const t = new URL(request.url).searchParams.get("t");
  if (t && t.length <= 2000 && !cachedAudio(id)) await registerSpeech(t).catch(() => null);

  const cached = cachedAudio(id);
  if (cached) {
    const mp3 = await readFile(cached);
    // Addressed by a hash of its text and voice, so it never changes.
    return new Response(mp3, { headers: headers({ "Content-Length": String(mp3.length), "Cache-Control": "public, max-age=31536000, immutable" }) });
  }
  try {
    return new Response(await streamSpeech(id), { headers: headers({ "Cache-Control": "no-store" }) });
  } catch (err) {
    console.error("tts stream failed", err.message);
    return new Response("Not found", { status: 404 });
  }
}
