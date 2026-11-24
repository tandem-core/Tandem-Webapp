// The app's Record button: a full conversation recorded on the phone.
//   multipart audio=<file> [title=<text>]
// Transcribes with timestamps, saves the audio, runs the medication check and
// recap, and returns the new visit's summary. Takes as long as transcription
// plus two Claude calls, so the app shows a "working on it" state.
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fromTranscript } from "../../../lib/conversation.mjs";
import { saveConversation, slugFor, listVisits, getVisit } from "../../../lib/store.mjs";
import { processConversation } from "../../../lib/pipeline.mjs";
import { transcribeRecording, medicationHints, TranscriptionUnavailable } from "../../../lib/transcribe.mjs";
import { AUDIO_TYPES } from "../../../lib/audio.mjs";
import { visitSummary } from "../../../lib/summaries.mjs";
import { DATA_DIR } from "../../../lib/datadir.mjs";
import { json, error, options } from "../_lib/http.js";

export const maxDuration = 300;
export const OPTIONS = options;

const MAX_BYTES = 200 * 1024 * 1024;
const EXT_FOR_TYPE = Object.fromEntries(Object.entries(AUDIO_TYPES).map(([ext, type]) => [type, ext]));

export async function POST(request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("audio");
  if (!file || typeof file === "string") return error(400, "no_audio", "Send the recording as 'audio'.");
  if (file.size > MAX_BYTES) return error(413, "too_large", "Recording is too large.");

  const id = randomUUID();
  const mimeType = file.type || "audio/mp4";
  const audio = Buffer.from(await file.arrayBuffer());

  let segments;
  try {
    segments = await transcribeRecording(audio, { mimeType, hints: medicationHints(await listVisits()) });
  } catch (err) {
    if (err instanceof TranscriptionUnavailable) return error(501, err.code, err.message);
    console.error("recording transcription failed", err);
    return error(502, "stt_failed", "Tandem couldn't transcribe that recording.");
  }
  if (!segments.length) return error(422, "empty", "No speech was found in the recording.");

  const recordedAt = new Date().toISOString();
  const title = String(form.get("title") ?? "").trim().slice(0, 80) || "Recorded conversation";
  const conversation = fromTranscript("upload", id, { title, recordedAt, segments });
  await saveConversation(conversation);
  await mkdir(join(DATA_DIR, "audio"), { recursive: true });
  await writeFile(join(DATA_DIR, "audio", slugFor(conversation.id) + (EXT_FOR_TYPE[mimeType] ?? ".m4a")), audio);

  try {
    await processConversation(conversation);
  } catch (err) {
    console.error("processing failed", err);
    return error(502, "processing_failed", "The recording was saved, but Tandem couldn't summarize it yet.");
  }
  return json({ visit: visitSummary(await getVisit(slugFor(conversation.id))) }, 201);
}
