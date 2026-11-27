// Demo state: who is using the app, what Mary shares with Lisa, and what Lisa has opened.
// Kept in memory on the phone, like the web family demo keeps it in the browser.
// shortcut: this is not access control. The API still returns everything to anyone,
// so real sign-in must enforce sharing on the server before real use.
import { useSyncExternalStore } from 'react';

export type Viewer = 'mary' | 'lisa';
export type Parts = { summary: boolean; transcript: boolean; recording: boolean };

let state = {
  viewer: 'mary' as Viewer,
  // Chosen once by Mary in setup and applied to every appointment. null until she chooses.
  sharing: null as Parts | null,
  sharingSince: null as string | null,
  // Appointments Lisa has opened, so newly shared ones stand out until she does.
  seen: [] as string[],
};

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const update = (next: Partial<typeof state>) => {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
};

export const useDemo = () => useSyncExternalStore(subscribe, () => state);
export const setViewer = (viewer: Viewer) => update({ viewer });
export const setSharing = (sharing: Parts) => update({ sharing, sharingSince: state.sharingSince ?? new Date().toISOString() });
export const markSeen = (slug: string) => !state.seen.includes(slug) && update({ seen: [...state.seen, slug] });

export const NOTHING: Parts = { summary: false, transcript: false, recording: false };
export const sharesAnything = (p: Parts | null) => Boolean(p && (p.summary || p.transcript || p.recording));
