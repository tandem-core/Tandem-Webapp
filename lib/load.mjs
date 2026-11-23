// Resolves a CLI argument to a Conversation: a fixture name ("doctor-visit"),
// a stored conversation id ("pocket:rec_123"), or a path to a fixture JSON file.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import { fromFixture } from "./conversation.mjs";
import { loadConversation } from "./store.mjs";

export async function resolveConversation(ref = "doctor-visit") {
  if (ref.includes(":")) return loadConversation(ref);
  const path = ref.endsWith(".json") ? ref : `fixtures/${ref}.json`;
  if (!existsSync(path)) throw new Error(`No fixture at ${path} and "${ref}" is not a stored conversation id`);
  const fixture = JSON.parse(await readFile(path, "utf8"));
  return { conversation: fromFixture(basename(path, ".json"), fixture), fixture };
}

export async function conversationOnly(ref) {
  const r = await resolveConversation(ref);
  return r.conversation ?? r;
}
