// Calls the Tandem web API. Shapes come from lib/summaries.mjs in the web app.
import { useEffect, useState } from 'react';

// `npm run web` points this at a local CORS proxy; see scripts/web.mjs.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://tandemweb.vercel.app';

export type VisitSummary = {
  slug: string;
  title: string;
  recordedAt: string;
  headline: string | null;
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
  segments: { idx: number; start: number; end: number }[];
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
export const getVisit = (slug: string) => request<Visit>(`/api/visits/${slug}`);

export const answerMedication = (slug: string, medId: string, answer: Answer) =>
  request<{ medication: Medication }>(`/api/visits/${slug}/medications/${medId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer }),
  });

/** Loads data once, with a reload function for retry and pull-to-refresh. */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    load()
      .then((d) => live && setData(d))
      .catch(() => live && setError("We couldn't load this. Check your internet connection and try again."));
    return () => {
      live = false;
    };
  }, [load, attempt]);

  const reload = () => {
    setError(null);
    setAttempt((n) => n + 1);
  };
  return { data, error, loading: !data && !error, reload };
}
