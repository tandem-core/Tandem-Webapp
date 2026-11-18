import { demoVisits } from "@/lib/demo-visits";
import heartburn from "@/demo-data/recaps/clip_01_medication_shared_decision.json";
import arthritis from "@/demo-data/recaps/clip_02_methotrexate_full_consultation.json";
import refill from "@/demo-data/recaps/clip_03_prescription_refill_counseling.json";
import bloodThinner from "@/demo-data/recaps/clip_05_anticoagulant_medication_error.json";
import screening from "@/demo-data/recaps/clip_06_three_party_screening_consultation.json";

const recaps = [heartburn, arthritis, refill, bloodThinner, screening];

export const demoTodos = demoVisits.flatMap(({ conversation }) => {
  const followUps = recaps.find((recap) => recap.conversationId === conversation.id)?.followUps ?? [];
  const tasks = followUps.filter((task) => task.status === "to_do").map((task) => {
    // Keep an approximate date approximate; do not invent a firm deadline.
    const approximateFollowUp = conversation.id === heartburn.conversationId && task.id === "followUp-3";
    const approximateDate = new Date(conversation.recordedAt);
    approximateDate.setUTCMonth(approximateDate.getUTCMonth() + 1);
    return {
      id: `${conversation.id}/${task.id}`,
      title: task.title,
      detail: task.detail,
      dueBy: task.dueBy ?? (approximateFollowUp ? approximateDate.toISOString().slice(0, 10) : null),
      approximate: approximateFollowUp,
      when: task.when,
      visitTitle: conversation.title,
      recordedAt: conversation.recordedAt,
      visitHref: `/demo/visits#visit-${conversation.sourceId}`,
    };
  });
  if (conversation.id === heartburn.conversationId) {
    tasks.unshift({
      id: `${conversation.id}/lower-dose-trial`,
      title: "Two-week lower-dose trial",
      detail: "Follow the lower-dose plan agreed with Dr. Smith for your heartburn medicine. Tandem could not verify the medicine’s name. Confirm it with your care team.",
      dueBy: null,
      approximate: false,
      when: "For two weeks, as agreed at your visit",
      visitTitle: conversation.title,
      recordedAt: conversation.recordedAt,
      visitHref: `/demo/visits#visit-${conversation.sourceId}`,
    });
  }
  return tasks;
}).sort((a, b) => {
  if (a.dueBy && b.dueBy) return a.dueBy.localeCompare(b.dueBy);
  if (a.dueBy) return -1;
  if (b.dueBy) return 1;
  return b.recordedAt.localeCompare(a.recordedAt);
});
