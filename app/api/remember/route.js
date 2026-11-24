// The Remember button. Accepts either
//   JSON      { "question": "What did the doctor say about my blood test?" }
//   multipart audio=<recorded question>  (needs a speech-to-text key)
// and returns a RememberResult (see lib/remember.mjs) plus the question as heard.
import { listVisits } from "../../../lib/store.mjs";
import { listRequests } from "../../../lib/db.mjs";
import { getHousehold } from "../../../lib/household.mjs";
import { remember } from "../../../lib/remember.mjs";
import { transcribeQuestion, medicationHints, TranscriptionUnavailable } from "../../../lib/transcribe.mjs";
import { json, error, options, readJson } from "../_lib/http.js";

export const OPTIONS = options;

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export async function POST(request) {
  const [visits, requests, household] = await Promise.all([listVisits(), listRequests(), getHousehold()]);
  let question;
  const type = request.headers.get("content-type") ?? "";

  if (type.startsWith("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("audio");
    if (!file || typeof file === "string") return error(400, "no_audio", "Send the recorded question as 'audio'.");
    if (file.size > MAX_AUDIO_BYTES) return error(413, "too_large", "That recording is too long for a question.");
    try {
      question = await transcribeQuestion(Buffer.from(await file.arrayBuffer()), {
        mimeType: file.type || "audio/m4a",
        hints: medicationHints(visits),
      });
    } catch (err) {
      if (err instanceof TranscriptionUnavailable) return error(501, err.code, err.message);
      console.error("transcription failed", err);
      return error(502, "stt_failed", "Tandem couldn't hear that. Please try again.");
    }
    if (!question) return error(422, "empty", "Tandem didn't catch a question. Please try again.");
  } else {
    question = String((await readJson(request))?.question ?? "").trim().slice(0, 500);
    if (!question) return error(400, "empty", "Ask a question first.");
  }

  try {
    const result = await remember(question, visits, { requests, helperName: household.helpers[0]?.name ?? null });
    return json({ question, ...result });
  } catch (err) {
    console.error("remember failed", err);
    return error(502, "remember_failed", "Tandem couldn't answer just now. Please try again.");
  }
}
