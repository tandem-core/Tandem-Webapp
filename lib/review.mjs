// The owner's corrections to a generated recap. Edits are written into the recap
// file with a flag, so the helper snapshot and the UI read one source.
import { loadRecap, saveRecap } from "./store.mjs";

const SECTIONS = ["followUps", "instructions", "unchanged", "openQuestions"];
const EDITABLE = new Set(["title", "detail", "text", "when"]);

function findItem(recap, itemId) {
  for (const section of SECTIONS) {
    const item = recap[section]?.find((i) => i.id === itemId);
    if (item) return item;
  }
  return null;
}

export async function editRecapItem(conversationId, itemId, patch) {
  const recap = await loadRecap(conversationId);
  if (!recap) throw new Error("Recap not found");
  const item = findItem(recap, itemId);
  if (!item) throw new Error(`No item ${itemId}`);
  for (const [k, v] of Object.entries(patch)) {
    if (!EDITABLE.has(k) || !(k in item)) continue;
    const text = String(v ?? "").trim();
    if (text && text !== item[k]) {
      item.original ??= {};
      item.original[k] ??= item[k];
      item[k] = text;
      item.editedByOwner = true;
    }
  }
  await saveRecap(recap);
  return item;
}

export async function hideRecapItem(conversationId, itemId) {
  const recap = await loadRecap(conversationId);
  const item = recap && findItem(recap, itemId);
  if (!item) throw new Error(`No item ${itemId}`);
  item.hidden = true;
  await saveRecap(recap);
}

export async function markReviewed(conversationId) {
  const recap = await loadRecap(conversationId);
  if (!recap) throw new Error("Recap not found");
  recap.reviewedAt = new Date().toISOString();
  await saveRecap(recap);
}

export function visibleItems(recap, section) {
  return (recap?.[section] ?? []).filter((i) => !i.hidden);
}

export { findItem };
