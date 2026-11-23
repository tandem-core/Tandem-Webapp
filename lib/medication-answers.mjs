// The owner's responses to the medication check. Stored on the review so the
// recap, Ask and sharing read one source.
import { loadMedications, saveMedications } from "./store.mjs";

async function update(conversationId, medId, fn) {
  const review = await loadMedications(conversationId);
  const med = review?.medications.find((m) => m.id === medId);
  if (!med) throw new Error(`No medication ${medId}`);
  fn(med);
  await saveMedications(review);
  return med;
}

/** answer: "yes" | "no" | "unsure" | null (null clears it) */
export function answerMedicationName(conversationId, medId, answer) {
  if (answer !== null && !["yes", "no", "unsure"].includes(answer)) throw new Error("Bad answer");
  return update(conversationId, medId, (med) => {
    if (answer === "yes" && !med.suggestion) throw new Error("Nothing to confirm");
    med.ownerAnswer = answer ? { answer, at: new Date().toISOString() } : null;
  });
}

/** What the owner's care team told them about an unclear or conflicting amount. */
export function recordCareTeamNote(conversationId, medId, text) {
  const clean = String(text ?? "").trim().slice(0, 300);
  return update(conversationId, medId, (med) => {
    med.careTeamNote = clean ? { text: clean, at: new Date().toISOString() } : null;
  });
}
