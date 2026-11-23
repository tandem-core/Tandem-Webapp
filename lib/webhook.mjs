import { createHmac, timingSafeEqual } from "node:crypto";

// Pocket signs `${X-HeyPocket-Timestamp}.${rawBody}` with HMAC-SHA256 (hex).
// https://docs.heypocketai.com/docs/api/webhooks
const MAX_SKEW_MS = 5 * 60 * 1000;

/**
 * @param {object} args
 * @param {string|Buffer} args.rawBody  exact bytes received, before JSON.parse
 * @param {string|undefined} args.signature  X-HeyPocket-Signature header
 * @param {string|undefined} args.timestamp  X-HeyPocket-Timestamp header (unix ms)
 * @param {string} args.secret
 * @param {number} [args.now]
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function verifyPocketSignature({ rawBody, signature, timestamp, secret, now = Date.now() }) {
  if (!secret) return { ok: false, reason: "no webhook secret configured" };
  if (!signature || !timestamp) return { ok: false, reason: "missing signature headers" };

  const ts = Number(timestamp);
  // Rejecting old timestamps stops a captured delivery from being replayed later.
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_SKEW_MS) {
    return { ok: false, reason: "timestamp outside allowed window" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(signature).trim().toLowerCase(), "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature mismatch" };
  }
  return { ok: true };
}

// Pocket delivers at least once and documents no delivery id, so dedupe on what
// identifies the processing result.
export function deliveryKey(payload) {
  const sums = payload?.summarizations ? Object.keys(payload.summarizations).sort().join(",") : "";
  return [payload?.event, payload?.recording?.id, sums].join("|");
}
