"use client";

import { useSyncExternalStore } from "react";
import { initialSharedSources, shareCookie } from "@/lib/family-demo-config";

export type VisitRequest = { id: string; sourceId: string; title: string; status: "pending" | "approved" | "declined"; createdAt: string };
const key = "tandem-demo-visit-requests";
const eventName = "tandem-visit-requests-changed";
let memory = "[]";
function snapshot() {
  try { return localStorage.getItem(key) ?? memory; } catch { return memory; }
}
function parse(value: string): VisitRequest[] {
  try {
    const data: unknown = JSON.parse(value);
    return Array.isArray(data) ? data.filter((item): item is VisitRequest => Boolean(item && typeof item.id === "string" && typeof item.sourceId === "string" && typeof item.title === "string" && ["pending", "approved", "declined"].includes(item.status))) : [];
  } catch { return []; }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(eventName, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(eventName, callback); };
}
function save(requests: VisitRequest[]) {
  memory = JSON.stringify(requests);
  try { localStorage.setItem(key, memory); } catch { /* Keep demo state in memory if storage is unavailable. */ }
  window.dispatchEvent(new Event(eventName));
}
export function useVisitRequests() {
  return parse(useSyncExternalStore(subscribe, snapshot, () => "[]"));
}
export function requestVisit(sourceId: string, title: string) {
  const requests = parse(snapshot());
  if (requests.some((item) => item.sourceId === sourceId && item.status !== "declined")) return;
  save([...requests, { id: crypto.randomUUID(), sourceId, title, status: "pending", createdAt: new Date().toISOString() }]);
}
export function decideVisitRequest(id: string, status: "approved" | "declined") {
  const requests = parse(snapshot()).map((item) => item.id === id && item.status === "pending" ? { ...item, status } : item);
  const shares = [...new Set([...initialSharedSources, ...requests.filter((item) => item.status === "approved").map((item) => item.sourceId)])];
  document.cookie = `${shareCookie}=${encodeURIComponent(JSON.stringify(shares))}; Path=/; Max-Age=31536000; SameSite=Lax`;
  save(requests);
}
