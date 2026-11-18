// Local prototype bridge. Python/SQLite must not be exposed as a public multi-user service.
async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Recording processing is available in the local development app. Run the Python service and npm run dev." }, { status: 503 });
  }
  const { path } = await context.params;
  if (!/^jobs(?:\/[a-f0-9-]{36}(?:\/clip-\d+-\d+\.mp3)?)?$/.test(path.join("/"))) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  if (request.method === "POST" && request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Use the local Tandem app to upload recordings." }, { status: 403 });
  }
  try {
    const body = request.method === "POST" ? await request.arrayBuffer() : undefined;
    if (body && body.byteLength > 24 * 1024 * 1024) return Response.json({ error: "Use a recording smaller than 24 MB." }, { status: 413 });
    const response = await fetch(`http://127.0.0.1:8765/${path.join("/")}${new URL(request.url).search}`, {
      method: request.method, body, headers: { "X-Tandem-Local": "1", "Content-Type": "application/octet-stream" },
      cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The recording service is not running. Start it with: npm run pipeline:serve" }, { status: 503 });
  }
}
export const GET = proxy;
export const POST = proxy;
