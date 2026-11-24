// GET /api/voice/phrases: the fixed phrases a device should download at start-up
// and play locally ("Let me check what the doctor said" while the answer is
// being prepared). Makes any missing audio first.
import { PHRASES, synthesize, speechUrl, VOICE } from "../../../../lib/tts.mjs";
import { json, options } from "../../_lib/http.js";

export const OPTIONS = options;

export async function GET() {
  const entries = await Promise.all(
    Object.entries(PHRASES).map(async ([key, text]) => {
      const audio = await synthesize(text).catch(() => null);
      return [key, { text, url: audio ? await speechUrl(text) : null }];
    }),
  );
  return json({ voice: VOICE, phrases: Object.fromEntries(entries) });
}
