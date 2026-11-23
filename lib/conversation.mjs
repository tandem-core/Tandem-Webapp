// Tandem's own conversation record. Everything downstream (recaps, Q&A, sharing)
// reads this shape, never Pocket's, so a manual upload or a fixture can stand in
// for the device during a demo.
//
// Conversation {
//   id: string               "pocket:<recordingId>" | "fixture:<name>" | "upload:<uuid>"
//   source: "pocket" | "fixture" | "upload"
//   sourceId: string
//   title: string
//   recordedAt: string|null  ISO 8601, UTC
//   durationSec: number|null
//   language: string|null
//   segments: Segment[]      ordered by start time
//   vendorSummary: VendorSummary|null   Pocket's own summary, kept for comparison only
//   ingestedAt: string
// }
// Segment { idx, speaker, speakerName, start, end, text }  start/end in seconds
// VendorSummary { markdown, bulletPoints: string[], actionItems: { title, dueDate, done }[] }

export function fromPocketRecording(data) {
  if (!data?.id) throw new Error("Pocket recording has no id");
  const rawSegments = Array.isArray(data.transcript)
    ? data.transcript
    : data.transcript?.segments ?? [];
  return build({
    source: "pocket",
    sourceId: data.id,
    title: data.title,
    recordedAt: data.recording_at ?? data.recordingAt,
    durationSec: data.duration,
    language: data.language,
    rawSegments,
    speakers: data.speakers,
    summarizations: data.summarizations,
  });
}

export function fromPocketWebhook(payload) {
  const rec = payload?.recording;
  if (!rec?.id) throw new Error("Webhook payload has no recording.id");
  return build({
    source: "pocket",
    sourceId: rec.id,
    title: rec.title,
    recordedAt: rec.recordingAt,
    durationSec: rec.duration,
    language: rec.language,
    rawSegments: Array.isArray(payload.transcript) ? payload.transcript : [],
    speakers: payload.speakers,
    summarizations: payload.summarizations,
  });
}

export function fromFixture(name, fixture) {
  return build({
    source: "fixture",
    sourceId: name,
    title: fixture.title,
    recordedAt: fixture.recordedAt ?? null,
    durationSec: fixture.durationSec ?? null,
    language: fixture.language ?? "English",
    rawSegments: fixture.segments,
    speakers: null,
    summarizations: null,
  });
}

/** For transcripts from other tools (e.g. Whisper SRT of a test clip). */
export function fromTranscript(source, sourceId, { title, recordedAt = null, durationSec = null, language = "English", segments }) {
  return build({ source, sourceId, title, recordedAt, durationSec, language, rawSegments: segments, speakers: null, summarizations: null });
}

function build({ source, sourceId, title, recordedAt, durationSec, language, rawSegments, speakers, summarizations }) {
  const segments = rawSegments
    .map((s) => ({
      speaker: s.speaker ?? "UNKNOWN",
      speakerName: s.speakerName ?? speakers?.[s.speaker]?.name ?? null,
      start: Number(s.start) || 0,
      end: Number(s.end) || 0,
      text: String(s.text ?? s.originalText ?? "").trim(),
    }))
    .filter((s) => s.text)
    .sort((a, b) => a.start - b.start)
    .map((s, idx) => ({ idx, ...s }));

  return {
    id: `${source}:${sourceId}`,
    source,
    sourceId,
    title: title || "Untitled conversation",
    recordedAt: recordedAt ?? null,
    durationSec: typeof durationSec === "number" ? durationSec : null,
    language: language ?? null,
    segments,
    vendorSummary: pickVendorSummary(summarizations),
    ingestedAt: new Date().toISOString(),
  };
}

// The webhook sends summarizations as a map keyed by summarization id; the REST
// docs leave the type unspecified, so accept a map or an array and take the most
// recently updated completed entry.
function pickVendorSummary(summarizations) {
  if (!summarizations || typeof summarizations !== "object") return null;
  const entries = (Array.isArray(summarizations) ? summarizations : Object.values(summarizations))
    .filter((s) => s?.v2 && (s.processingStatus ?? "completed") === "completed")
    .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
  const v2 = entries[0]?.v2;
  if (!v2) return null;
  return {
    markdown: v2.summary?.markdown ?? "",
    bulletPoints: v2.summary?.bulletPoints ?? [],
    actionItems: (v2.actionItems?.actionItems ?? []).map((a) => ({
      title: a.title,
      dueDate: a.dueDate ?? null,
      done: Boolean(a.isCompleted ?? a.is_completed),
    })),
  };
}

export function transcriptText(conversation) {
  return conversation.segments
    .map((s) => `[${s.idx}] ${formatTime(s.start)} ${s.speakerName ?? s.speaker}: ${s.text}`)
    .join("\n");
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
