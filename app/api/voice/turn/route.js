// POST /api/voice/turn: one turn of the spoken conversation (see lib/voice.mjs).
//   multipart: event=question, audio=<recording>, sessionId?
//   JSON:      { "event": "question", "text": "...", "sessionId": "..." }
//              { "event": "tap", "sessionId": "..." }
//              { "event": "choose", "slug": "...", "sessionId": "..." }  after "which visit do you mean?"
// Returns { sessionId, heard, expect, actions[], result, timings }.
import { handleTurn } from "../../../../lib/voice.mjs";
import { TranscriptionUnavailable } from "../../../../lib/transcribe.mjs";
import { json, error, options, readJson } from "../../_lib/http.js";

export const OPTIONS = options;

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export async function POST(request) {
  let input;
  if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("audio");
    input = { sessionId: form.get("sessionId") || undefined, event: form.get("event") || "question" };
    if (file && typeof file !== "string") {
      if (file.size > MAX_AUDIO_BYTES) return error(413, "too_large", "That recording is too long for a question.");
      input.audio = Buffer.from(await file.arrayBuffer());
      input.mimeType = file.type || "audio/wav";
    } else input.text = form.get("text") ?? "";
  } else {
    const body = (await readJson(request)) ?? {};
    input = { sessionId: body.sessionId, event: body.event ?? "question", text: body.text, slug: body.slug };
  }
  if (!["question", "tap", "choose"].includes(input.event)) return error(400, "bad_event", "event must be question, tap or choose");

  try {
    return json(await handleTurn(input));
  } catch (err) {
    if (err instanceof TranscriptionUnavailable) return error(501, err.code, err.message);
    console.error("voice turn failed", err);
    return error(502, "turn_failed", "Tandem couldn't answer just now.");
  }
}
