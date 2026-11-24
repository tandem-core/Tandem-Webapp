// Ask a helper to take on one follow-up.
//   { "itemId": "followUp-1", "helperId": "lisa", "message": "...", "includeHeadline": false }
// Returns { token, link } where link is the helper's page.
import { getVisit } from "../../../../../lib/store.mjs";
import { requestHelp, RequestError } from "../../../../../lib/requests.mjs";
import { json, error, options, readJson } from "../../../_lib/http.js";

export const OPTIONS = options;

const STATUS = { not_found: 404, unknown_helper: 400, unchecked_medication: 409 };

export async function POST(request, { params }) {
  const { slug } = await params;
  const visit = await getVisit(slug);
  if (!visit?.recap) return error(404, "not_found", "Visit not found");
  const body = (await readJson(request)) ?? {};
  try {
    const res = await requestHelp(visit, body);
    return json({ ...res, link: `${new URL(request.url).origin}/h/${res.token}` });
  } catch (err) {
    if (err instanceof RequestError) return error(STATUS[err.code] ?? 400, err.code, err.message);
    throw err;
  }
}
