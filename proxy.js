// Testing track only: when TANDEM_PASSCODE is set, the whole site asks for one shared
// passcode (any user name). The browser then sends it with every request.
export function proxy(request) {
  const code = process.env.TANDEM_PASSCODE;
  if (!code) return;
  const [scheme, value] = (request.headers.get("authorization") ?? "").split(" ");
  const pass = scheme === "Basic" && value ? atob(value).split(":").slice(1).join(":") : null;
  if (pass === code) return;
  return new Response("Passcode required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Tandem test"' } });
}