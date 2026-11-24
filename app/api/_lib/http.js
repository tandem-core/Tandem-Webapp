// Helpers for the JSON API the phone app calls. The underscore keeps this folder
// out of routing.
//
// No authentication yet: the API serves one owner on a development machine.
// Accounts (Supabase) must come before anyone else's data goes through it.

// Expo's web preview runs on another port, so allow cross-origin calls in
// development. Native iOS/Android requests aren't subject to CORS.
const CORS =
  process.env.NODE_ENV === "production"
    ? {}
    : {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };

export function json(body, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

export function error(status, code, message) {
  return json({ error: { code, message } }, status);
}

export function options() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
