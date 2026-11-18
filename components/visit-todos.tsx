"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { demoTodos as todos } from "@/lib/demo-todos";
import styles from "./visit-todos.module.css";

const storageKey = "tandem-completed-visit-todos";
const changeEvent = "tandem-todos-changed";
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(changeEvent, callback);
  };
}
let fallback = "[]";
function snapshot() {
  try { return localStorage.getItem(storageKey) ?? fallback; } catch { return fallback; }
}
function readCompleted(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
}

export default function VisitTodos() {
  const stored = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const completed = readCompleted(stored);
  const completedCount = todos.filter(({ id }) => completed.includes(id)).length;

  return (
    <section className={styles.card} aria-labelledby="visit-todos-heading">
      <div className={styles.heading}>
        <h2 id="visit-todos-heading">Your to-dos</h2>
        <span className={styles.progress} aria-live="polite">{completedCount} of {todos.length} done</span>
      </div>
      <p className={styles.source}>Next steps from all your visits. Older tasks stay here until you mark them done.</p>
      <ul className={styles.list}>
        {todos.map(({ id, title, detail, visitTitle, recordedAt, visitHref, dueBy, approximate, when }) => (
          <li key={id}>
            <label className={styles.todo}>
              <input type="checkbox" checked={completed.includes(id)} onChange={(event) => {
                const checked = event.currentTarget.checked;
                const current = readCompleted(snapshot());
                fallback = JSON.stringify(checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
                try { localStorage.setItem(storageKey, fallback); } catch { /* Keep in memory when storage is unavailable. */ }
                window.dispatchEvent(new Event(changeEvent));
              }} />
              <span>
                <span className={`${styles.title}${completed.includes(id) ? ` ${styles.completed}` : ""}`}>{title}</span>
                <span className={styles.detail}>{detail}</span>
                {(dueBy || when) && <span className={styles.timing}>{dueBy ? `${approximate ? "Around" : "Visit target:"} ${dateFormat.format(new Date(`${dueBy}T00:00:00Z`))}${approximate ? " · approximate follow-up timing" : ""}` : when}</span>}
              </span>
            </label>
            <Link className={styles.taskSource} href={visitHref}>{dateFormat.format(new Date(recordedAt))} · {visitTitle} <span aria-hidden="true">→</span></Link>
          </li>
        ))}
      </ul>
      <Link className={styles.link} href="/demo/visits">View all visits <span aria-hidden="true">→</span></Link>
    </section>
  );
}
