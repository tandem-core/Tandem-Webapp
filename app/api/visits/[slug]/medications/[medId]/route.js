// The owner's response to a medication check:
//   { "answer": "yes" | "no" | "unsure" | null }   after listening to the name
//   { "careTeamNote": "..." }                      what the care team said about an amount
import { getVisit } from "../../../../../../lib/store.mjs";
import { answerMedicationName, recordCareTeamNote } from "../../../../../../lib/medication-answers.mjs";
import { json, error, options, readJson } from "../../../../_lib/http.js";

export const OPTIONS = options;

export async function POST(request, { params }) {
  const { slug, medId } = await params;
  const visit = await getVisit(slug);
  if (!visit) return error(404, "not_found", "Visit not found");
  const body = (await readJson(request)) ?? {};
  try {
    if ("answer" in body) return json({ medication: await answerMedicationName(visit.conversation.id, medId, body.answer) });
    if ("careTeamNote" in body) return json({ medication: await recordCareTeamNote(visit.conversation.id, medId, body.careTeamNote) });
    return error(400, "bad_request", "Send answer or careTeamNote.");
  } catch (err) {
    return error(400, "bad_request", err.message);
  }
}
