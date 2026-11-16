import { demoSummaries } from "@/lib/demo-summaries";
import medications5 from "@/demo-data/medications/clip_06_three_party_screening_consultation.json";
import medications4 from "@/demo-data/medications/clip_05_anticoagulant_medication_error.json";
import medications2 from "@/demo-data/medications/clip_03_prescription_refill_counseling.json";
import medications1 from "@/demo-data/medications/clip_02_methotrexate_full_consultation.json";
import medications0 from "@/demo-data/medications/clip_01_medication_shared_decision.json";
import conversation0 from "@/demo-data/conversations/clip_01_medication_shared_decision.json";
import conversation1 from "@/demo-data/conversations/clip_02_methotrexate_full_consultation.json";
import conversation2 from "@/demo-data/conversations/clip_03_prescription_refill_counseling.json";
import conversation4 from "@/demo-data/conversations/clip_05_anticoagulant_medication_error.json";
import conversation5 from "@/demo-data/conversations/clip_06_three_party_screening_consultation.json";

export const demoVisits = [
  { conversation: conversation0, summary: demoSummaries[conversation0.id], medications: medications0.medications, audioUrl: "/demo-audio/clip_01_medication_shared_decision.mp3" },
  { conversation: conversation1, summary: demoSummaries[conversation1.id], medications: medications1.medications, audioUrl: "/demo-audio/clip_02_methotrexate_full_consultation.mp3" },
  { conversation: conversation2, summary: demoSummaries[conversation2.id], medications: medications2.medications, audioUrl: "/demo-audio/clip_03_prescription_refill_counseling.mp3" },
  { conversation: conversation4, summary: demoSummaries[conversation4.id], medications: medications4.medications, audioUrl: "/demo-audio/clip_05_anticoagulant_medication_error.mp3" },
  { conversation: conversation5, summary: demoSummaries[conversation5.id], medications: medications5.medications, audioUrl: "/demo-audio/clip_06_three_party_screening_consultation.mp3" },
].sort((a, b) => Date.parse(b.conversation.recordedAt) - Date.parse(a.conversation.recordedAt));
