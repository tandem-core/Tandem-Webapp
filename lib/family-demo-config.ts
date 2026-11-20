export const initialSharedSources = ["01_medication_shared_decision", "02_methotrexate_full_consultation"];
export const shareCookie = "tandem-demo-family-shares";
export const familyProfile = {
  name: "Lisa Doe", email: "lisa.doe@gmail.com", relationship: "Daughter",
  parentName: "Mary Doe", parentEmail: "mary.doe@gmail.com",
};

export function familyVoice(text: string) {
  return text
    .replace(/\byou were\b/gi, "Mary was")
    .replace(/\byou are\b/gi, "Mary is")
    .replace(/\byou have\b/gi, "Mary has")
    .replace(/\byou do\b/gi, "Mary does")
    .replace(/\byour\b/gi, "Mary’s")
    .replace(/\byou\b/gi, "Mary");
}
