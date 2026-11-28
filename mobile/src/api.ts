// Calls the Tandem web API. Shapes come from lib/summaries.mjs in the web app.
import { RecordingPresets } from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

// The web build is served by the Next.js site at /phone, so it calls the API on the
// same site. `npm run web` overrides this with a local CORS proxy (scripts/web.mjs).
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'web' ? '' : 'https://tandemweb.vercel.app');

export type VisitSummary = {
  slug: string;
  title: string;
  recordedAt: string;
  headline: string | null;
  reviewed: boolean;
  medicationsToCheck: number;
  todoCount: number;
};

export type Home = { owner: { name: string }; visits: VisitSummary[] };

export type Answer = 'yes' | 'no' | 'unsure';

export type Medication = {
  id: string;
  heardAs: string;
  role: string;
  roleDetail: string;
  suggestion: { name: string } | null;
  doseStatements: { text: string; unclear: boolean }[];
  evidence: number[];
  ownerAnswer: { answer: Answer } | null;
  needsReview: boolean;
  nameResolved: boolean;
  doseNeedsCheck: boolean;
  // How the server names it without claiming more certainty than it has (lib/medications.mjs).
  displayName?: string;
};

export type SummaryItem = { id: string; text: string; evidence: number[] };

export type Visit = VisitSummary & {
  audioUrl: string;
  segments: { idx: number; start: number; end: number; text: string }[];
  followUps: {
    id: string;
    title: string;
    when: string | null;
    evidence: number[];
    uncheckedMedication: boolean;
    status: string;
    request: { status: string; helperName: string } | null;
  }[];
  instructions: SummaryItem[];
  unchanged: SummaryItem[];
  openQuestions: (SummaryItem & { resolvesWhen: string | null })[];
  medications: Medication[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_URL + path, init);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export const getHome = () => request<Home>('/api/home');

/** The appointment list, refreshed whenever the screen comes back into view (for example after recording). */
export function useHome() {
  const home = useLoad(getHome);
  useFocusEffect(home.reload);
  return home;
}
export const getVisit = (slug: string) => request<Visit>(`/api/visits/${slug}`);

/**
 * Joel's help request (lib/requests.mjs): asks Lisa to take on one to-do. Called directly
 * because the voice turn's yes/no lives in one server instance's memory, which a second
 * request on Vercel may not reach. Resolves to the error code on failure.
 */
export async function askForHelp(slug: string, itemId: string): Promise<{ existing?: boolean } | { error: string }> {
  const res = await fetch(`${API_URL}/api/visits/${slug}/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, helperId: 'lisa', message: 'Could you help me with this?', includeHeadline: false }),
  }).catch(() => null);
  const body = await res?.json().catch(() => null);
  return res?.ok ? body : { error: body?.error?.code ?? 'offline' };
}

/** Every appointment in full, newest first (for to-dos, which come from each one). */
export async function getAllVisits() {
  const { visits } = await getHome();
  return Promise.all(visits.map((v) => getVisit(v.slug)));
}
export function useAllVisits() {
  const all = useLoad(getAllVisits);
  useFocusEffect(all.reload);
  return all;
}

/** A playable excerpt of a recording: the lines from `start` to `end` seconds. */
export const clipUrl = (slug: string, start: number, end: number) => `${API_URL}/api/audio/${slug}/clip?start=${start.toFixed(2)}&end=${end.toFixed(2)}`;

// The running medicine list (testing track: /api/meds, built by lib/med-log.mjs).
// The running medicine list (testing track: /api/meds, built by lib/med-log.mjs). `med` is the
// medicine's record from that appointment, as on the visit page.
export type MedEntry = {
  medicine: string;
  change: string;
  detail: string;
  dose: string | null;
  date: string;
  slug: string;
  title: string;
  med: Medication | null;
  nameUnclear: boolean;
  amountUnclear: boolean;
};
export type Meds = { current: MedEntry[] };
export const getMeds = () => request<Meds>('/api/meds');

export const answerMedication = (slug: string, medId: string, answer: Answer) =>
  request<{ medication: Medication }>(`/api/visits/${slug}/medications/${medId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer }),
  });

// One turn of Joel's voice conversation (app/api/voice/turn, lib/voice.mjs), typed instead of spoken.
export type TurnAction =
  | { type: 'speak'; text: string; url: string | null }
  | { type: 'play'; url: string; text: string; speaker: string; visit: string; start: number }
  | { type: 'listen'; expect: 'question' | 'yes_no' | 'choice' };

export type Turn = {
  sessionId: string;
  heard: string;
  expect: 'question' | 'yes_no' | 'choice';
  actions: TurnAction[];
  result: {
    status: string;
    options?: { slug: string; title: string; recordedAt: string }[];
    clips?: { quote?: string }[];
    visit?: { slug: string } | null;
    nextStep?: { type: string; followUpId?: string } | null;
  } | null;
  fromCache?: boolean;
};

export const askTurn = (body: { event: 'question' | 'choose'; text?: string; slug?: string; sessionId?: string }) =>
  request<Turn>('/api/voice/turn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Sends a phone recording to Joel's /api/recordings, which transcribes and summarizes it.
export class RecordingError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

// Mono speech at 48 kbps, for appointments and spoken questions.
export const RECORDING = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 48000, web: { mimeType: 'audio/webm', bitsPerSecond: 48000 } };

async function audioForm(uri: string) {
  const form = new FormData();
  if (Platform.OS === 'web') {
    // The browser records webm; send the plain type so the server stores it as .webm.
    const blob = await (await fetch(uri)).blob();
    form.append('audio', new File([blob], 'recording.webm', { type: 'audio/webm' }));
  } else {
    form.append('audio', { uri, name: 'recording.m4a', type: 'audio/mp4' } as unknown as Blob);
  }
  return form;
}

/** A spoken question, sent to the same voice turn route as the device uses. */
export async function askSpoken(uri: string, sessionId?: string): Promise<Turn> {
  const form = await audioForm(uri);
  form.append('event', 'question');
  if (sessionId) form.append('sessionId', sessionId);
  const res = await fetch(API_URL + '/api/voice/turn', { method: 'POST', body: form }).catch(() => null);
  if (!res) throw new RecordingError('offline');
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new RecordingError(body?.error?.code ?? String(res.status));
  return body;
}

export async function uploadRecording(uri: string): Promise<VisitSummary> {
  const form = await audioForm(uri);
  const res = await fetch(API_URL + '/api/recordings', { method: 'POST', body: form }).catch(() => null);
  if (!res) throw new RecordingError('offline');
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new RecordingError(body?.error?.code ?? String(res.status));
  return body.visit;
}

/** Loads data once, with a reload function for retry and pull-to-refresh. */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    load()
      .then((d) => live && setData(d))
      .catch(() => live && setError("Couldn't load. Check your internet."));
    return () => {
      live = false;
    };
  }, [load, attempt]);

  const reload = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);
  return { data, error, loading: !data && !error, reload };
}
