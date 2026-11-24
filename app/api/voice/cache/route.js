// GET /api/voice/cache: rehearsed answers that can be replayed without the
// internet (see lib/voice-cache.mjs), newest first.
import { listCachedTurns } from "../../../../lib/voice-cache.mjs";
import { json, options } from "../../_lib/http.js";

export const OPTIONS = options;

export async function GET() {
  return json({ turns: await listCachedTurns() });
}
