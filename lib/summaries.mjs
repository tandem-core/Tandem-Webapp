// Shapes visits for the phone app's screens. Kept apart from the routes so the
// web prototype and tests can use the same counts.
import { visibleItems } from "./review.mjs";
import { needsReview, nameResolved, doseResolved, doseNeedsCheck, displayName, unresolvedMedsFor } from "./medications.mjs";

export function visitSummary(visit, requests = []) {
  const c = visit.conversation;
  const done = new Set(requests.filter((r) => r.conversationId === c.id && r.status === "done").map((r) => r.followUpId));
  const todo = visibleItems(visit.recap, "followUps").filter((f) => f.status === "to_do" && !done.has(f.id));
  return {
    slug: visit.slug,
    title: c.title,
    recordedAt: c.recordedAt,
    headline: visit.recap?.headline ?? null,
    reviewed: Boolean(visit.recap?.reviewedAt),
    todoCount: todo.length,
    firstDue: todo.map((f) => f.dueBy).filter(Boolean).sort()[0] ?? null,
    medicationsToCheck: (visit.medications?.medications ?? []).filter(needsReview).length,
  };
}

/** Everything the visit screen needs, including the lines quotes point to. */
export function visitDetail(visit, requests = []) {
  const c = visit.conversation;
  const mine = requests.filter((r) => r.conversationId === c.id);
  const latestRequestFor = (id) => mine.filter((r) => r.followUpId === id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  const meds = visit.medications;
  const withFlags = (item) => ({ ...item, uncheckedMedication: unresolvedMedsFor(meds, item.evidence).length > 0 });

  return {
    ...visitSummary(visit, requests),
    audioUrl: `/api/audio/${visit.slug}`,
    segments: c.segments.map(({ idx, start, end, text, speakerName, speaker }) => ({ idx, start, end, text, speaker: speakerName ?? speaker })),
    followUps: visibleItems(visit.recap, "followUps").map((f) => {
      const req = latestRequestFor(f.id);
      return {
        ...withFlags(f),
        request: req ? { status: req.status, helperName: req.helperName, helperNote: req.helperNote } : null,
      };
    }),
    instructions: visibleItems(visit.recap, "instructions").map(withFlags),
    unchanged: visibleItems(visit.recap, "unchanged").map(withFlags),
    openQuestions: visibleItems(visit.recap, "openQuestions").map(withFlags),
    medications: (meds?.medications ?? []).map((m) => ({
      ...m,
      displayName: displayName(m),
      needsReview: needsReview(m),
      nameResolved: nameResolved(m),
      doseResolved: doseResolved(m),
      doseNeedsCheck: doseNeedsCheck(m),
    })),
  };
}
