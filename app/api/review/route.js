// Saves one review response from /review to data/review/responses.json,
// keyed by item id (later answers replace earlier ones).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "../../../lib/datadir.mjs";
import { json, error, readJson } from "../_lib/http.js";

const DIR = join(DATA_DIR, "review");
const FILE = join(DIR, "responses.json");

let queue = Promise.resolve();

export async function POST(request) {
  const body = await readJson(request);
  if (!body?.id || typeof body.id !== "string" || typeof body.response !== "object") return error(400, "bad_request", "id and response are required");
  const run = queue.then(async () => {
    await mkdir(DIR, { recursive: true });
    const all = JSON.parse(await readFile(FILE, "utf8").catch(() => "{}"));
    all[body.id] = { ...body.response, at: new Date().toISOString() };
    await writeFile(FILE, JSON.stringify(all, null, 2));
    return Object.keys(all).length;
  });
  queue = run.catch(() => {});
  return json({ saved: true, total: await run });
}
