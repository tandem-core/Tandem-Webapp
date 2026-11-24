import { getVisit } from "../../../../lib/store.mjs";
import { listRequests } from "../../../../lib/db.mjs";
import { visitDetail } from "../../../../lib/summaries.mjs";
import { getHousehold } from "../../../../lib/household.mjs";
import { json, error, options } from "../../_lib/http.js";

export const OPTIONS = options;

export async function GET(_request, { params }) {
  const { slug } = await params;
  const visit = await getVisit(slug);
  if (!visit?.recap) return error(404, "not_found", "Visit not found");
  const [requests, household] = await Promise.all([listRequests({ conversationId: visit.conversation.id }), getHousehold()]);
  return json({ ...visitDetail(visit, requests), owner: household.owner, helpers: household.helpers });
}
