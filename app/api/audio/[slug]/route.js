// Streams a visit's audio to the owner's browser. Supports Range requests so the
// player can seek straight to a quote without downloading the whole file.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getVisit } from "../../../../lib/store.mjs";
import { localAudio, pocketAudioUrl, parseRange } from "../../../../lib/audio.mjs";


export async function GET(request, { params }) {
  const { slug } = await params;
  const visit = await getVisit(slug);
  if (!visit) return new Response("Not found", { status: 404 });
  const { conversation } = visit;

  const local = localAudio(conversation.id);
  if (local) {
    const { size } = await stat(local.path);
    const range = parseRange(request.headers.get("range"), size);
    const common = { "Content-Type": local.type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" };
    if (range?.unsatisfiable) {
      return new Response(null, { status: 416, headers: { ...common, "Content-Range": `bytes */${size}` } });
    }
    if (range) {
      const stream = createReadStream(local.path, { start: range.start, end: range.end });
      return new Response(Readable.toWeb(stream), {
        status: 206,
        headers: { ...common, "Content-Length": String(range.end - range.start + 1), "Content-Range": `bytes ${range.start}-${range.end}/${size}` },
      });
    }
    return new Response(Readable.toWeb(createReadStream(local.path)), {
      status: 200,
      headers: { ...common, "Content-Length": String(size) },
    });
  }

  if (conversation.source === "pocket" && process.env.POCKET_API_KEY) {
    try {
      // S3 signed URLs honour Range themselves, so hand the browser off.
      return Response.redirect(await pocketAudioUrl(conversation.sourceId), 302);
    } catch (err) {
      console.error("pocket audio url failed", err);
      return new Response("Audio unavailable", { status: 502 });
    }
  }

  return new Response("No audio for this visit", { status: 404 });
}
