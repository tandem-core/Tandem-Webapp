// Demo state: who is using the app and which appointments Mary shares with Lisa.
// Kept in memory on the phone, like the web family demo keeps it in the browser
// (lib/family-demo-config.ts). shortcut: this is not access control. The API still
// returns every appointment, so real sign-in must enforce sharing on the server.
import { useSyncExternalStore } from 'react';

export type Viewer = 'mary' | 'lisa';

// Same starting shares as the web demo's initialSharedSources.
let state = {
  viewer: 'mary' as Viewer,
  shared: ['clip_01_medication_shared_decision', 'clip_02_methotrexate_full_consultation'],
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
export const setShared = (slug: string, on: boolean) =>
  update({ shared: on ? [...state.shared, slug] : state.shared.filter((s) => s !== slug) });
