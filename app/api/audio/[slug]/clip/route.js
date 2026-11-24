// GET /api/audio/<visit>/clip?start=46.96&end=61.73
// A standalone WAV of that part of the recording (padded slightly at both ends),
// for devices that just play files: the Raspberry Pi, the browser device.
import { getVisit } from "../../../../../lib/store.mjs";
import { ensureWav, sliceWav } from "../../../../../lib/clips.mjs";


export async function GET(request, { params }) {
  const { slug } = await params;
  const url = new URL(request.url);
  const start = Number(url.searchParams.get("start"));
  const end = Number(url.searchParams.get("end"));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start < 0) {
    return new Response("start and end (seconds) are required, with end > start", { status: 400 });
  }
  const visit = await getVisit(slug);
  if (!visit) return new Response("Not found", { status: 404 });

  try {
    const wav = await ensureWav(visit.conversation);
    if (!wav) return new Response("No audio for this visit", { status: 404 });
    const clip = await sliceWav(wav, start, end);
    return new Response(clip, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(clip.length),
        "Cache-Control": "private, max-age=86400",
        "Access-Control-Allow-Origin": process.env.NODE_ENV === "production" ? "" : "*",
      },
    });
  } catch (err) {
    if (err instanceof RangeError) return new Response("Clip is outside the recording", { status: 416 });
    console.error("clip failed", err);
    return new Response("Couldn't cut that clip", { status: 500 });
  }
}
