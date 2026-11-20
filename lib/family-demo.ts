import "server-only";
import { cookies } from "next/headers";
import { demoVisits } from "@/lib/demo-visits";
import { demoTodos } from "@/lib/demo-todos";
import { initialSharedSources, shareCookie } from "@/lib/family-demo-config";
export { familyProfile } from "@/lib/family-demo-config";

export function selectFamilyData(sourceIds: string[]) {
  const shared = new Set(sourceIds);
  const sharedVisits = demoVisits.filter(({ conversation }) => shared.has(conversation.sourceId));
  const sharedActionItems = demoTodos
    .filter((task) => sharedVisits.some(({ conversation }) => task.id.startsWith(`${conversation.id}/`)))
    .map((task) => ({ ...task, visitHref: task.visitHref.replace("/demo/visits", "/family-demo/visits") }));
  // Only title and date are offered for unshared visits; files stay out of the family page.
  const requestableVisits = demoVisits.filter(({ conversation }) => !shared.has(conversation.sourceId))
    .map(({ conversation }) => ({ sourceId: conversation.sourceId, title: conversation.title, recordedAt: conversation.recordedAt }));
  return { sharedVisits, sharedActionItems, requestableVisits };
}

// Public, single-browser demo state; this cookie is not production authorization.
export async function getFamilyData() {
  const store = await cookies();
  let sources = initialSharedSources;
  try {
    const saved: unknown = JSON.parse(decodeURIComponent(store.get(shareCookie)?.value ?? "null"));
    if (Array.isArray(saved) && saved.every((id) => typeof id === "string")) sources = saved;
  } catch { /* Use the seeded shares when no valid demo cookie exists. */ }
  return selectFamilyData(sources);
}
