// What happens to a conversation after it arrives: medication check first, so
// the recap can avoid stating names and amounts Tandem isn't sure of.
import { saveMedications, saveRecap, loadMedications } from "./store.mjs";
import { reviewMedications } from "./medications.mjs";
import { generateRecap } from "./recap.mjs";

/**
 * @param {object} conversation
 * @param {object} [opts]
 * @param {boolean} [opts.reuseMedications]  keep an existing check (and the owner's answers)
 * @returns {Promise<{ medications: object, recap: object }>}
 */
export async function processConversation(conversation, { reuseMedications = false } = {}) {
  let medications = reuseMedications ? await loadMedications(conversation.id) : null;
  if (!medications) {
    medications = await reviewMedications(conversation);
    await saveMedications(medications);
  }
  const recap = await generateRecap(conversation, { medications });
  await saveRecap(recap);
  return { medications, recap };
}
