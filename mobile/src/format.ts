// Plain helpers with no React Native imports, so `npm test` can run them in Node.
import type { Medication, Turn, Visit } from './api';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dateParts(iso: string) {
  const d = new Date(iso);
  return { month: MONTHS[d.getMonth()], day: d.getDate(), weekday: DAYS[d.getDay()] };
}

export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Percent positions along the player track, nudged apart so close moments don't hide each other. */
export function markerPositions(starts: number[], length: number, gap = 8) {
  const out: number[] = [];
  for (const start of starts) {
    const at = length ? (start / length) * 100 : 0;
    out.push(out.length ? Math.max(at, out[out.length - 1] + gap) : at);
  }
  // Then pull back from the end of the track if that pushed any past it.
  for (let i = out.length - 1; i >= 0; i--) out[i] = Math.min(out[i], i === out.length - 1 ? 100 : out[i + 1] - gap);
  return out;
}

/** "15 milligram daily for two weeks" -> "15 mg". Uses the last clear amount mentioned. */
export function doseOf(med: Medication) {
  const units: Record<string, string> = { milligram: 'mg', mg: 'mg', microgram: 'mcg', mcg: 'mcg' };
  for (const s of [...med.doseStatements].reverse()) {
    const m = !s.unclear && s.text.match(/(\d+(?:\.\d+)?)\s*(milligram|mg|microgram|mcg)/i);
    if (m) return `${m[1]} ${units[m[2].toLowerCase()]}`;
  }
  return null;
}

// Medicines the plan depends on, as opposed to ones only mentioned or turned down.
const SKIP_ROLES = ['not_chosen', 'discussed'];

/** Medicines Mary should check against her label. */
export function labelChecks(visit: Visit) {
  return visit.medications.filter((m) => m.needsReview && m.suggestion && !SKIP_ROLES.includes(m.role));
}

/**
 * Other medicines Mary takes or was told to take that the server says need a check
 * (unclear name or amount). Medicines only mentioned or turned down are left out.
 * shortcut: the list's "Something to check" flag counts those too, so a visit whose
 * only unclear medicine was turned down shows the flag with no check here. Fix in
 * the API's medicationsToCheck count if that comes up.
 */
export function otherChecks(visit: Visit) {
  const label = labelChecks(visit);
  return visit.medications.filter((m) => m.needsReview && !SKIP_ROLES.includes(m.role) && !label.includes(m));
}

export function checkReason(med: Medication) {
  if (med.doseNeedsCheck) return `Unclear amount for ${med.nameResolved ? med.heardAs : `“${med.heardAs}”`}`;
  return `Unclear name: “${med.heardAs}”`;
}

/**
 * The words to show for an Ask answer. When the server can't reach its AI it says
 * "check the internet connection", which is wrong here: the phone just reached the
 * server. A saved (cached) answer is still shown as the server words it.
 */
export function answerOf(turn: Turn) {
  if (!turn.result && !turn.fromCache) return 'Answers aren’t available right now.';
  return turn.actions.flatMap((a) => (a.type === 'speak' ? [a.text] : [])).join(' ');
}

/** "Summary, Recording", or "Nothing". */
export function partsLabel(p: { summary: boolean; transcript: boolean; recording: boolean }) {
  const names = [p.summary && 'Summary', p.transcript && 'Transcript', p.recording && 'Recording'].filter(Boolean);
  return names.length ? names.join(', ') : 'Nothing';
}

/** An appointment stands out for Lisa when it was recorded after Mary set up sharing and Lisa hasn't opened it. */
export function isNewForLisa(visit: { slug: string; recordedAt: string }, sharingSince: string | null, seen: string[]) {
  return Boolean(sharingSince && visit.recordedAt > sharingSince && !seen.includes(visit.slug));
}

/** Summaries speak to Mary ("your medicine"); Lisa reads them about Mary. Same rules as familyVoice in lib/family-demo-config.ts. */
export function aboutMary(text: string) {
  return text
    .replace(/\byou were\b/gi, 'Mary was')
    .replace(/\byou are\b/gi, 'Mary is')
    .replace(/\byou have\b/gi, 'Mary has')
    .replace(/\byou do\b/gi, 'Mary does')
    .replace(/\byour\b/gi, 'Mary’s')
    .replace(/\byou\b/gi, 'Mary');
}
