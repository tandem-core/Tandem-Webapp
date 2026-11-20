import type { demoVisits } from "@/lib/demo-visits";

export function prescriptionEntries(visits: typeof demoVisits) {
  return visits.flatMap(({ conversation, medications }) => medications
  .filter((medicine) => ["started", "changed", "existing"].includes(medicine.role) ||
    (medicine.role === "proposed" && medicine.kind === "specific") ||
    (conversation.id === "clip:01_medication_shared_decision" &&
      (medicine.role === "not_chosen" || ["Tums", "Gaviscon"].includes(medicine.heardAs))))
  .map((medicine) => ({ conversation, medicine, key: `${conversation.id}/${medicine.id}` }))
);
}
