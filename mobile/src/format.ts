// Plain helpers with no React Native imports, so `npm test` can run them in Node.
import type { Medication, Turn, Visit } from './api';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dateParts(iso: string) {
  const d = new Date(iso);
  return { month: MONTHS[d.getMonth()], day: d.getDate(), weekday: DAYS[d.getDay()] };
}

/** "Nov 3" */
export function shortDate(iso: string) {
  const { month, day } = dateParts(iso);
  return `${month.slice(0, 3)} ${day}`;
}

/** A player marker: "2 Pick" for "Pick up the new prescription". */
export function markerLabel(title: string, i: number) {
  const word = title.match(/[A-Za-z][a-z]+/)?.[0] ?? '';
  return `${i + 1} ${word.length <= 8 ? word : ''}`.trim();
}

export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const UNITS: Record<string, string> = { milligram: 'mg', mg: 'mg', microgram: 'mcg', mcg: 'mcg' };

/** "15 milligram daily for two weeks" -> "15 mg". */
export function amountOf(text: string) {
  const m = text.match(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(milligram|mg|microgram|mcg)/i);
  return m ? `${m[1]} ${UNITS[m[2].toLowerCase()]}` : null;
}

/** The last clear amount mentioned for a medicine. */
export function doseOf(med: Medication) {
  for (const s of [...med.doseStatements].reverse()) {
    const amount = !s.unclear && amountOf(s.text);
    if (amount) return amount;
  }
  return null;
}

// Medicines the plan depends on, as opposed to ones only mentioned or turned down.
const SKIP_ROLES = ['not_chosen', 'discussed'];

/** Medicines Mary should check against her label. */
export const isLabelCheck = (m: Medication) => Boolean(m.needsReview && m.suggestion && !SKIP_ROLES.includes(m.role));
export const labelChecks = (visit: Visit) => visit.medications.filter(isLabelCheck);

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
  // The spoken lead-in and sign-off are for listeners; on screen, the date and "Hear it" say the same.
  const text = turn.actions
    .flatMap((a) => (a.type === 'speak' ? [a.text] : []))
    .join(' ')
    .replace(/\s*Here's what was said\./g, '')
    // Device instructions; the app shows buttons instead.
    .replace(/\s*Hold the button[^.]*\./g, '');
  const intro = text.match(/^From your (?:(?:\w+, )?(\w+ \d+) )?recordings?\.\s*/);
  if (!intro) return text;
  const rest = text.slice(intro[0].length);
  // Keep the date only when the answer doesn't already say it.
  const date = intro[1];
  return date && !new RegExp(`\\b${date}\\b`).test(rest) ? `${date}: ${rest}` : rest;
}

/**
 * One short line for an appointment card: the opening of the headline when that alone is
 * short and safe to show, otherwise the medicine started or changed with its dose, otherwise
 * the first to-do. Never a cut-off dose (brief() keeps numbers whole).
 */
export function homeLine(visit: Visit) {
  const names = visit.medications.flatMap((m) => [m.heardAs, m.suggestion?.name ?? '']);
  const short = visit.headline ? brief(visit.headline, names).short : '';
  if (short && short.split(/\s+/).length <= 10) return short;
  const med = ['changed', 'started'].flatMap((role) => visit.medications.filter((m) => m.role === role && doseOf(m)))[0];
  if (med) {
    const name = med.nameResolved ? (med.suggestion?.name ?? med.heardAs) : `“${med.heardAs}”`;
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${doseOf(med)}`;
  }
  return visit.followUps[0]?.title ?? short;
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

/**
 * The shortest opening of a server sentence that leaves nothing important out: what is
 * cut must have no numbers, nothing in quotes and none of `names` (medicines). Cuts
 * happen only at a sentence end or a comma. Returns the whole text when nothing can go.
 */
export function brief(text: string, names: string[] = []) {
  const lower = names.filter(Boolean).map((n) => n.toLowerCase());
  const safeToHide = (rest: string) => !/\d|["“”'‘’]/.test(rest) && !lower.some((n) => rest.toLowerCase().includes(n));
  // Sentence ends (not after a title such as "Dr.") and commas.
  const cuts = [...text.matchAll(/(?<!\b(?:Dr|Mr|Mrs|Ms|St))[.!?](?=\s)|,(?=\s)/g)].map((m) => m.index!);
  for (const at of cuts) {
    const rest = text.slice(at + 1).trim();
    if (text.slice(0, at).split(/\s+/).length >= 6 && safeToHide(rest)) return { short: text.slice(0, at) + '.', rest };
  }
  return { short: text, rest: '' };
}
