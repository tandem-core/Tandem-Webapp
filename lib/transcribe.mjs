// Speech-to-text for the phone app: short spoken questions, and full recordings
// made with the app's Record button. Claude doesn't transcribe audio, so this
// uses a separate service, chosen by which key is set:
//   DEEPGRAM_API_KEY  Deepgram (preferred: speaker labels for recordings)
//   OPENAI_API_KEY    OpenAI
// Override with TANDEM_STT=deepgram|openai. DEEPGRAM_MODEL picks the Deepgram
// model. Default nova-3-medical: on the four medication test clips it spelled
// drug names right 36 times with no garbles (nova-3: 32/2, Whisper: 21/18;
// `npm run stt-compare`). The Deepgram path is tested against the live API;
// the OpenAI path has not been run yet.
//
// Drug names are where transcription errors hurt, so callers pass known
// medication names as hints.

export class TranscriptionUnavailable extends Error {
  constructor() {
    super("No speech-to-text service configured. Set DEEPGRAM_API_KEY or OPENAI_API_KEY.");
    this.code = "no_stt";
  }
}

export function sttProvider(env = process.env) {
  const choice = env.TANDEM_STT;
  if (choice === "deepgram" && env.DEEPGRAM_API_KEY) return "deepgram";
  if (choice === "openai" && env.OPENAI_API_KEY) return "openai";
  if (env.DEEPGRAM_API_KEY) return "deepgram";
  if (env.OPENAI_API_KEY) return "openai";
  return null;
}

/**
 * A short spoken question to text.
 * @param {Buffer} audio
 * @param {object} opts { mimeType, hints: string[], fetchImpl }
 * @returns {Promise<string>}
 */
export async function transcribeQuestion(audio, { mimeType = "audio/m4a", hints = [], fetchImpl = fetch, env = process.env } = {}) {
  const provider = sttProvider(env);
  if (!provider) throw new TranscriptionUnavailable();
  if (provider === "deepgram") {
    const body = await deepgram(audio, { mimeType, hints, fetchImpl, env, params: { model: env.DEEPGRAM_MODEL ?? "nova-3-medical", smart_format: "true" } });
    return body?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
  }
  const body = await openai(audio, { mimeType, hints, fetchImpl, env, model: env.TANDEM_STT_MODEL ?? "gpt-4o-transcribe", format: "json" });
  return String(body?.text ?? "").trim();
}

/**
 * A full recording to timed segments, ready for fromTranscript().
 * @returns {Promise<{ start, end, text, speaker, speakerName }[]>}
 */
export async function transcribeRecording(audio, { mimeType = "audio/m4a", hints = [], fetchImpl = fetch, env = process.env } = {}) {
  const provider = sttProvider(env);
  if (!provider) throw new TranscriptionUnavailable();
  if (provider === "deepgram") {
    const body = await deepgram(audio, {
      mimeType,
      hints,
      fetchImpl,
      env,
      params: { model: env.DEEPGRAM_MODEL ?? "nova-3-medical", smart_format: "true", diarize: "true", utterances: "true" },
    });
    // Deepgram's utterances are whole speaker turns (up to ~40 s), too long to
    // play as a quote, so lines are rebuilt from per-word timestamps.
    const words = body?.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
    return words.length ? wordsToSegments(words) : [];
  }
  // whisper-1 is OpenAI's model that returns segment timestamps.
  const body = await openai(audio, { mimeType, hints, fetchImpl, env, model: "whisper-1", format: "verbose_json", segments: true });
  return (body?.segments ?? []).map((s) => ({ start: s.start, end: s.end, text: s.text, speaker: "SPEAKER", speakerName: null }));
}

const MAX_WORDS = 30;
const MIN_WORDS_BEFORE_SENTENCE_BREAK = 4;
const PAUSE_BREAK_SECONDS = 1.5;

/**
 * Groups timed words into short lines: a new line starts when the speaker
 * changes, after a sentence ends (once the line has a few words), after a long
 * pause, or at MAX_WORDS.
 * @param {{ word, punctuated_word?, start, end, speaker? }[]} words
 * @returns {{ start, end, text, speaker, speakerName: null }[]}
 */
export function wordsToSegments(words) {
  const out = [];
  let cur = null;
  const flush = () => {
    if (cur?.words.length) {
      out.push({
        start: cur.words[0].start,
        end: cur.words.at(-1).end,
        text: cur.words.map((w) => w.punctuated_word ?? w.word).join(" "),
        speaker: `SPEAKER_${String(cur.speaker ?? 0).padStart(2, "0")}`,
        speakerName: null,
      });
    }
    cur = null;
  };
  for (const w of words) {
    const prev = cur?.words.at(-1);
    const sentenceEnded = prev && /[.?!]$/.test(prev.punctuated_word ?? "") && cur.words.length >= MIN_WORDS_BEFORE_SENTENCE_BREAK;
    if (cur && (w.speaker !== cur.speaker || sentenceEnded || w.start - prev.end > PAUSE_BREAK_SECONDS || cur.words.length >= MAX_WORDS)) flush();
    cur ??= { speaker: w.speaker, words: [] };
    cur.words.push(w);
  }
  flush();
  return out;
}

async function deepgram(audio, { mimeType, hints, fetchImpl, env, params }) {
  const url = new URL("https://api.deepgram.com/v1/listen");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (const h of hints.slice(0, 50)) url.searchParams.append("keyterm", h);
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Token ${env.DEEPGRAM_API_KEY}`, "Content-Type": mimeType },
    body: audio,
  });
  if (!res.ok) throw new Error(`Deepgram ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function openai(audio, { mimeType, hints, fetchImpl, env, model, format, segments = false }) {
  const form = new FormData();
  const ext = (mimeType.split("/")[1] ?? "m4a").replace("mpeg", "mp3").replace("x-m4a", "m4a");
  form.append("file", new Blob([audio], { type: mimeType }), `audio.${ext}`);
  form.append("model", model);
  form.append("response_format", format);
  if (segments) form.append("timestamp_granularities[]", "segment");
  if (hints.length) form.append("prompt", `Medications that may be mentioned: ${hints.slice(0, 40).join(", ")}.`);
  const res = await fetchImpl("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI transcription ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** Drug names from the owner's visits, to help recognise them when spoken. */
export function medicationHints(visits) {
  const names = new Set();
  for (const v of visits) {
    for (const m of v.medications?.medications ?? []) {
      if (m.nameState === "clear") names.add(m.heardAs);
      if (m.suggestion && m.ownerAnswer?.answer === "yes") names.add(m.suggestion.name);
    }
  }
  return [...names];
}
