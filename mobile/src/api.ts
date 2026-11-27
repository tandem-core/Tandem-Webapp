// Calls the Tandem web API. Shapes come from lib/summaries.mjs in the web app.
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
};

export type Home = {
  owner: { name: string };
  visits: VisitSummary[];
};

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
};

export type SummaryItem = { id: string; text: string; evidence: number[] };

export type Visit = VisitSummary & {
  audioUrl: string;
  segments: { idx: number; start: number; end: number; text: string }[];
  followUps: { id: string; title: string; when: string | null; evidence: number[]; uncheckedMedication: boolean }[];
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

export const answerMedication = (slug: string, medId: string, answer: Answer) =>
  request<{ medication: Medication }>(`/api/visits/${slug}/medications/${medId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer }),
  });

// One turn of Joel's voice conversation (app/api/voice/turn, lib/voice.mjs), typed instead of spoken.
export type TurnAction =
  | { type: 'speak'; text: string; url: string | null }
  | { type: 'play'; url: string; text: string; speaker: string; visit: string }
  | { type: 'listen'; expect: 'question' | 'yes_no' | 'choice' };

export type Turn = {
  sessionId: string;
  heard: string;
  expect: 'question' | 'yes_no' | 'choice';
  actions: TurnAction[];
  result: { status: string; options?: { slug: string; title: string; recordedAt: string }[] } | null;
  fromCache?: boolean;
};

export const askTurn = (body: { event: 'question' | 'choose'; text?: string; slug?: string; sessionId?: string }) =>
  request<Turn>('/api/voice/turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// Sends a phone recording to Joel's /api/recordings, which transcribes and summarizes it.
export class RecordingError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export async function uploadRecording(uri: string): Promise<VisitSummary> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    // The browser records webm; send the plain type so the server stores it as .webm.
    const blob = await (await fetch(uri)).blob();
    form.append('audio', new File([blob], 'recording.webm', { type: 'audio/webm' }));
  } else {
    form.append('audio', { uri, name: 'recording.m4a', type: 'audio/mp4' } as unknown as Blob);
  }
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
