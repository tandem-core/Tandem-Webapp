// POST /api/voice/heard: transcribe a spoken question and return a short
// acknowledgement built from it, so a client can say "Let me see what the doctor
// said about your blood work" while the answer is prepared. The client then
// sends the text to /api/voice/turn.
//   multipart: audio=<recording>
// Returns { heard, ack: { text, url } }; url is null when speech synthesis is off.
import { listVisits } from "../../../../lib/store.mjs";
import { transcribeQuestion, medicationHints, TranscriptionUnavailable } from "../../../../lib/transcribe.mjs";
import { speechUrl } from "../../../../lib/tts.mjs";
import { ackFor } from "../../../../lib/ack.mjs";
import { json, error, options } from "../../_lib/http.js";

export const OPTIONS = options;

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export async function POST(request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("audio");
  if (!file || typeof file === "string") return error(400, "no_audio", "Send the recording as audio.");
  if (file.size > MAX_AUDIO_BYTES) return error(413, "too_large", "That recording is too long for a question.");
  try {
    const medicines = medicationHints(await listVisits());
    const heard = (await transcribeQuestion(Buffer.from(await file.arrayBuffer()), { mimeType: file.type || "audio/webm", hints: medicines })).trim();
    if (!heard) return json({ heard: "", ack: null });
    const text = ackFor(heard, { medicines });
    return json({ heard, ack: { text, url: await speechUrl(text) } });
  } catch (err) {
    if (err instanceof TranscriptionUnavailable) return error(501, err.code, err.message);
    console.error("transcription failed", err);
    return error(502, "stt_failed", "Tandem couldn't hear that just now.");
  }
}
