// What Tandem says while it looks for an answer. Built from the transcribed
// question without a model call, so it can play about a second after the owner
// stops talking: "Let me see what the doctor said about your blood test."
// Falls back to a general phrase when the question doesn't give a short topic.

const GENERAL = [
  "Let me check what the doctor said.",
  "One moment, I'll look at your recordings.",
  "Let me look that up for you.",
  "Okay, let me check.",
];

const SWAP = { my: "your", me: "you", i: "you", "i'm": "you're", mine: "yours", myself: "yourself", am: "are", "i've": "you've" };
const youFor = (s) => s.replace(/\b(my|me|i|i'm|mine|myself|am|i've)\b/gi, (w) => SWAP[w.toLowerCase()]);

// Topics too vague to repeat back.
const VAGUE = /^(it|that|this|them|those|these|things?|stuff|everything|anything|what|today|the visit|the appointment)$/i;
const MAX_TOPIC_WORDS = 6;

function cleanTopic(raw) {
  let t = raw
    .replace(/\b(again|today|please|for me|exactly|last time|at the (last )?(visit|appointment))\b/gi, "")
    .replace(/[^\w' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || VAGUE.test(t) || t.split(" ").length > MAX_TOPIC_WORDS) return null;
  return youFor(t);
}

const pick = (list, seed) => list[[...seed].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % list.length];

/**
 * @param {string} question  as transcribed or typed
 * @param {object} [opts]
 * @param {string[]} [opts.medicines]  medicine names from the owner's visits
 * @returns {string} one short sentence
 */
export function ackFor(question, { medicines = [] } = {}) {
  const q = String(question ?? "").trim();
  const lower = q.toLowerCase().replace(/[?.!]+$/, "");
  if (!lower) return GENERAL[0];

  const role = lower.match(/\b(doctor|nurse|pharmacist|surgeon|specialist)\b/)?.[1];
  const about = lower.match(/\babout (.+)$/);
  if (about) {
    const topic = cleanTopic(about[1]);
    if (topic) return `Let me see what ${role ? `the ${role}` : "was"} said about ${topic}.`;
  }
  if (/\b(next|follow[- ]?up) (appointment|visit)\b/.test(lower)) return "Let me check when your next appointment is.";
  // "What is my arthritis medicine?", "What arthritis medicine was I prescribed?"
  const what =
    lower.match(/^(?:what|which)(?:'s| is| are| was| were)? (?:my|the) ([a-z' -]{3,40})$/) ??
    lower.match(/^(?:what|which) ([a-z' -]{3,40}?) (?:was|were|did) (?:i|they|the doctor)\b/);
  if (what) {
    const topic = cleanTopic(what[1]);
    if (topic) return `Let me check what was said about ${/^(your|the)\b/.test(topic) ? topic : `your ${topic}`}.`;
  }
  const med = medicines.find((m) => m && lower.includes(m.toLowerCase()));
  if (med) return `Let me check what was said about ${med.toLowerCase()}.`;
  const take = lower.match(/\b(?:take|taking|use|stop|start) (?:the |my )?([a-z' -]{3,40})$/);
  if (take) {
    const topic = cleanTopic(take[1]);
    if (topic) return `Let me check what was said about ${topic}.`;
  }
  if (/\bwhat did (the )?(doctor|they|she|he|nurse|pharmacist) (say|tell)\b/.test(lower)) return "Let me check what the doctor said.";
  return pick(GENERAL, lower);
}
