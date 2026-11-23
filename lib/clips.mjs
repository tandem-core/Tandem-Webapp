// Ready-to-play excerpts of a recording, so a device only has to play a file.
//
// Every source (MP3 from Pocket or the test clips, M4A from an iPhone, WebM
// from a browser) is converted once to 16 kHz mono WAV and cached in
// data/audio-wav/. Cutting a WAV is then a byte-range copy: no decoding, cheap
// enough to do per request even on a Raspberry Pi.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, open, rename } from "node:fs/promises";
import { join, extname } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { localAudio, downloadPocketAudio } from "./audio.mjs";
import { slugFor } from "./store.mjs";
import { DATA_DIR } from "./datadir.mjs";

const run = promisify(execFile);
const WAV_DIR = join(DATA_DIR, "audio-wav");

// Transcript timestamps are approximate; padding keeps first and last syllables.
export const LEAD_IN = 0.3;
export const TAIL = 0.35;
// Soft edges: a clip that starts or stops at full volume sounds cut off.
export const FADE_IN = 0.12;
export const FADE_OUT = 0.25;
// Silence after each clip, so consecutive excerpts read as separate moments.
export const TRAILING_SILENCE = 0.15;
export const MAX_CLIP_SECONDS = 60;

const converting = new Map();

/** Path to a WAV of the conversation's audio, converting (once) if needed. */
export async function ensureWav(conversation) {
  let src = localAudio(conversation.id);
  if (!src && conversation.source === "pocket") {
    await downloadPocketAudio(conversation);
    src = localAudio(conversation.id);
  }
  if (!src) return null;
  if (extname(src.path).toLowerCase() === ".wav") return src.path;

  const out = join(WAV_DIR, `${slugFor(conversation.id)}.wav`);
  if (existsSync(out)) return out;
  if (!converting.has(out)) {
    converting.set(
      out,
      (async () => {
        await mkdir(WAV_DIR, { recursive: true });
        const tmp = `${out}.${process.pid}.tmp.wav`;
        await run(ffmpegPath, ["-y", "-loglevel", "error", "-i", src.path, "-ac", "1", "-ar", "16000", "-sample_fmt", "s16", tmp]);
        await rename(tmp, out);
        return out;
      })().finally(() => converting.delete(out)),
    );
  }
  return converting.get(out);
}

/** Locates the fmt and data chunks of a PCM WAV file. */
export async function readWavLayout(path) {
  const fh = await open(path, "r");
  try {
    const head = Buffer.alloc(4096);
    const { bytesRead } = await fh.read(head, 0, head.length, 0);
    const buf = head.subarray(0, bytesRead);
    if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") throw new Error("Not a WAV file");
    let off = 12;
    let fmt = null;
    while (off + 8 <= buf.length) {
      const id = buf.toString("ascii", off, off + 4);
      const size = buf.readUInt32LE(off + 4);
      if (id === "fmt ") {
        fmt = {
          channels: buf.readUInt16LE(off + 10),
          sampleRate: buf.readUInt32LE(off + 12),
          byteRate: buf.readUInt32LE(off + 16),
          blockAlign: buf.readUInt16LE(off + 20),
          bitsPerSample: buf.readUInt16LE(off + 22),
        };
      } else if (id === "data") {
        if (!fmt) throw new Error("WAV data before fmt");
        const { size: fileSize } = await fh.stat();
        // Some writers leave the data size as 0 or 0xFFFFFFFF when streaming.
        const dataSize = size === 0 || size === 0xffffffff ? fileSize - (off + 8) : Math.min(size, fileSize - (off + 8));
        return { fmt, dataOffset: off + 8, dataSize };
      }
      off += 8 + size + (size % 2);
    }
    throw new Error("WAV data chunk not found");
  } finally {
    await fh.close();
  }
}

export function wavHeader(fmt, dataLength) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0, "ascii");
  h.writeUInt32LE(36 + dataLength, 4);
  h.write("WAVE", 8, "ascii");
  h.write("fmt ", 12, "ascii");
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(fmt.channels, 22);
  h.writeUInt32LE(fmt.sampleRate, 24);
  h.writeUInt32LE(fmt.byteRate, 28);
  h.writeUInt16LE(fmt.blockAlign, 32);
  h.writeUInt16LE(fmt.bitsPerSample, 34);
  h.write("data", 36, "ascii");
  h.writeUInt32LE(dataLength, 40);
  return h;
}

/**
 * A standalone WAV of [start, end] seconds, padded by LEAD_IN/TAIL and clamped
 * to the recording.
 * @returns {Promise<Buffer>}
 */
export async function sliceWav(path, start, end, { pad = true } = {}) {
  const { fmt, dataOffset, dataSize } = await readWavLayout(path);
  const duration = dataSize / fmt.byteRate;
  const s = Math.max(0, start - (pad ? LEAD_IN : 0));
  const e = Math.min(duration, end + (pad ? TAIL : 0), s + MAX_CLIP_SECONDS);
  if (!(e > s)) throw new RangeError("Empty clip");
  const align = (sec) => Math.floor((sec * fmt.byteRate) / fmt.blockAlign) * fmt.blockAlign;
  const from = align(s);
  const to = align(e);
  const fh = await open(path, "r");
  try {
    const pcm = Buffer.alloc(to - from);
    await fh.read(pcm, 0, pcm.length, dataOffset + from);
    if (pad && fmt.bitsPerSample === 16) applyFades(pcm, fmt);
    const silence = pad ? Buffer.alloc(Math.round(TRAILING_SILENCE * fmt.sampleRate) * fmt.blockAlign) : Buffer.alloc(0);
    return Buffer.concat([wavHeader(fmt, pcm.length + silence.length), pcm, silence]);
  } finally {
    await fh.close();
  }
}

/** Linear fade in and out on 16-bit PCM, in place. */
export function applyFades(pcm, fmt) {
  const frames = pcm.length / fmt.blockAlign;
  const fadeIn = Math.min(frames / 2, Math.round(FADE_IN * fmt.sampleRate));
  const fadeOut = Math.min(frames / 2, Math.round(FADE_OUT * fmt.sampleRate));
  for (let f = 0; f < frames; f++) {
    let gain = 1;
    if (f < fadeIn) gain = f / fadeIn;
    else if (f >= frames - fadeOut) gain = (frames - 1 - f) / fadeOut;
    if (gain === 1) continue;
    for (let ch = 0; ch < fmt.channels; ch++) {
      const off = f * fmt.blockAlign + ch * 2;
      pcm.writeInt16LE(Math.round(pcm.readInt16LE(off) * gain), off);
    }
  }
}

export async function wavDuration(path) {
  const { fmt, dataSize } = await readWavLayout(path);
  return dataSize / fmt.byteRate;
}
