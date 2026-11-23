// Server-side Pocket REST client. The API key must never reach a browser.
// Docs: https://docs.heypocketai.com/docs/api

const BASE_URL = "https://public.heypocketai.com/api/v1";

export class PocketError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = "PocketError";
    this.status = status;
    this.code = code;
  }
}

// The docs don't name the field holding the signed URL, so accept the likely
// shapes: a bare string, or an object with a url-ish key.
function extractUrl(data) {
  if (typeof data === "string" && /^https?:\/\//.test(data)) return data;
  if (!data || typeof data !== "object") return null;
  for (const key of ["url", "audio_url", "audioUrl", "download_url", "downloadUrl", "signed_url", "signedUrl", "presigned_url"]) {
    if (typeof data[key] === "string" && /^https?:\/\//.test(data[key])) return data[key];
  }
  return null;
}

export function createPocketClient(apiKey = process.env.POCKET_API_KEY, { fetchImpl = fetch } = {}) {
  if (!apiKey || !apiKey.startsWith("pk_")) {
    throw new PocketError("POCKET_API_KEY is missing or does not start with pk_");
  }

  async function get(path, params = {}) {
    const url = new URL(BASE_URL + path);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    const body = await res.json().catch(() => null);
    // The docs show success:true even on some error bodies, so trust the HTTP status first.
    if (!res.ok || body?.success === false) {
      throw new PocketError(body?.error || `Pocket API ${res.status} on ${path}`, {
        status: res.status,
        code: body?.error_code,
      });
    }
    return body;
  }

  return {
    /**
     * Pre-signed S3 URL for the recording's audio.
     * @returns {Promise<{ url: string, expiresAt: number }>}
     */
    async getAudioUrl(id, { expiresIn = 3600 } = {}) {
      const body = await get(`/public/recordings/${encodeURIComponent(id)}/audio-url`, { expires_in: expiresIn });
      const url = extractUrl(body.data);
      if (!url) throw new PocketError(`No audio URL in response for ${id}: ${JSON.stringify(body.data).slice(0, 200)}`);
      return { url, expiresAt: Date.now() + expiresIn * 1000 };
    },

    /** @returns {{ data: object[], pagination: object }} */
    listRecordings({ startDate, endDate, page = 1, limit = 20 } = {}) {
      return get("/public/recordings", { start_date: startDate, end_date: endDate, page, limit });
    },

    /** Full recording, including transcript segments and summarizations by default. */
    async getRecording(id, { includeTranscript = true, includeSummarizations = true } = {}) {
      const body = await get(`/public/recordings/${encodeURIComponent(id)}`, {
        include_transcript: includeTranscript,
        include_summarizations: includeSummarizations,
      });
      return body.data;
    },
  };
}
