"use client";

import { useSyncExternalStore } from "react";

export type SchedulingHelp = { taskId: string; status: "requested" | "helping" | "handled" };
const key = "tandem-demo-scheduling-help";
const eventName = "tandem-scheduling-help-changed";
// Seed an example so the family demo immediately shows Mary's follow-up request.
const initial = JSON.stringify([{ taskId: "clip:01_medication_shared_decision/followUp-3", status: "requested" }]);
let memory = initial;
function snapshot() {
  try { return localStorage.getItem(key) ?? memory; } catch { return memory; }
}
function parse(value: string): SchedulingHelp[] {
  try {
    const data: unknown = JSON.parse(value);
    return Array.isArray(data) ? data.filter((item): item is SchedulingHelp => Boolean(item && typeof item.taskId === "string" && ["requested", "helping", "handled"].includes(item.status))) : [];
  } catch { return []; }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(eventName, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(eventName, callback); };
}
function save(requests: SchedulingHelp[]) {
  memory = JSON.stringify(requests);
  try { localStorage.setItem(key, memory); } catch { /* Retain local demo state in memory. */ }
  window.dispatchEvent(new Event(eventName));
}
export function useSchedulingHelp() {
  return parse(useSyncExternalStore(subscribe, snapshot, () => initial));
}
export function requestSchedulingHelp(taskId: string) {
  const requests = parse(snapshot());
  if (requests.some((request) => request.taskId === taskId && request.status !== "handled")) return;
  save([...requests.filter((request) => request.taskId !== taskId), { taskId, status: "requested" }]);
}
export function updateSchedulingHelp(taskId: string, status: "helping" | "handled") {
  save(parse(snapshot()).map((request) => request.taskId === taskId && request.status !== "handled" ? { ...request, status } : request));
}
export function cancelSchedulingHelp(taskId: string) {
  save(parse(snapshot()).filter((request) => request.taskId !== taskId));
}
