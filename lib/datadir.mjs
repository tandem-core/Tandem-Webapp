// Where Tandem keeps its files.
//
// Locally: data/ (or TANDEM_DATA_DIR).
// On Vercel: the deployment's files are read-only and only /tmp is writable,
// and each server instance starts empty. So the committed demo dataset
// (demo-data/, made by `npm run export-demo`) is copied into /tmp on first
// use, audio included (about 30 MB, well under a second). Anything written
// there (help requests, medication answers, new recordings) lasts only as long
// as that instance: fine for a shared demo, not for real use. Real storage (Supabase)
// replaces this before anyone relies on it.
import { existsSync, mkdirSync, cpSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Load .env or .env.local if present and not already loaded into process.env
function loadEnvFile(filename) {
  try {
    if (!existsSync(filename)) return;
    const content = readFileSync(filename, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch {
    // Ignore read errors
  }
}
loadEnvFile(".env");
loadEnvFile(".env.local");

const BUNDLED = resolve("demo-data");

function resolveDataDir() {
  if (process.env.TANDEM_DATA_DIR) return process.env.TANDEM_DATA_DIR;
  if (!process.env.VERCEL) {
    if (!existsSync("data") && existsSync(BUNDLED)) {
      mkdirSync("data", { recursive: true });
      cpSync(BUNDLED, "data", { recursive: true });
    }
    return "data";
  }

  const dir = "/tmp/tandem-data";
  const marker = join(dir, ".seeded");
  if (!existsSync(marker) && existsSync(BUNDLED)) {
    mkdirSync(dir, { recursive: true });
    // Copied, not linked: the bundle is read-only and recordings add audio files.
    cpSync(BUNDLED, dir, { recursive: true });
    writeFileSync(marker, new Date().toISOString());
  }
  return dir;
}

export const DATA_DIR = resolveDataDir();
