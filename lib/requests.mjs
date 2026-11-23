// Asking a helper for help with one follow-up. Shared by the web prototype's
// server actions and the phone app's API so both enforce the same rules.
import { findItem } from "./review.mjs";
import { unresolvedMedsFor } from "./medications.mjs";
import { createRequest, listRequests } from "./db.mjs";
import { getHelper } from "./household.mjs";

export class RequestError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/**
 * @returns {Promise<{ token: string, existing?: true }>}
 * @throws {RequestError} code: not_found | unknown_helper | unchecked_medication
 */
export async function requestHelp(visit, { itemId, helperId, message, includeHeadline }) {
  const item = findItem(visit.recap, itemId);
  if (!item || item.hidden || !visit.recap.followUps.includes(item)) throw new RequestError("Follow-up not found", "not_found");
  // A follow-up resting on an unchecked medication name or amount can't go to
  // family as if it were settled.
  if (unresolvedMedsFor(visit.medications, item.evidence).length) {
    throw new RequestError("Check the medication in this item first.", "unchecked_medication");
  }
  const helper = await getHelper(helperId);
  if (!helper) throw new RequestError("Unknown helper", "unknown_helper");

  const open = (await listRequests({ conversationId: visit.conversation.id })).find(
    (r) => r.followUpId === itemId && (r.status === "requested" || r.status === "accepted"),
  );
  if (open) return { token: open.token, existing: true };

  // The helper sees this snapshot only: never the transcript or other items.
  const req = await createRequest({
    conversationId: visit.conversation.id,
    followUpId: itemId,
    helper,
    message: String(message ?? "").trim().slice(0, 500),
    includeHeadline: Boolean(includeHeadline),
    snapshot: {
      title: item.title,
      detail: item.detail,
      when: item.when,
      dueBy: item.dueBy,
      headline: includeHeadline ? visit.recap.headline : null,
    },
  });
  console.log(`[notify] ${helper.name}: help request ${req.id} -> /h/${req.token}`);
  return { token: req.token };
}
