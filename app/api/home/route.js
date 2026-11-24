import { listVisits } from "../../../lib/store.mjs";
import { listRequests } from "../../../lib/db.mjs";
import { getHousehold } from "../../../lib/household.mjs";
import { visitSummary } from "../../../lib/summaries.mjs";
import { sttProvider } from "../../../lib/transcribe.mjs";
import { json, options } from "../_lib/http.js";

export const OPTIONS = options;

/** Home screen: owner, visits newest first, help requests, and what the server can do. */
export async function GET() {
  const [household, visits, requests] = await Promise.all([getHousehold(), listVisits(), listRequests()]);
  return json({
    owner: household.owner,
    helpers: household.helpers,
    visits: visits.filter((v) => v.recap).map((v) => visitSummary(v, requests)),
    requests: requests.map((r) => ({
      id: r.id,
      title: r.snapshot.title,
      helperName: r.helperName,
      status: r.status,
      helperNote: r.helperNote,
      updatedAt: r.updatedAt,
    })),
    capabilities: { speechToText: Boolean(sttProvider()) },
  });
}
