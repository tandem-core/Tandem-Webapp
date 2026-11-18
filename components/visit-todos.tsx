"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { demoVisits } from "@/lib/demo-visits";
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

  function toggle(id: string, checked: boolean) {
    const current = readCompleted(snapshot());
    fallback = JSON.stringify(checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
    try { localStorage.setItem(storageKey, fallback); } catch { /* Keep in memory when storage is unavailable. */ }
    window.dispatchEvent(new Event(changeEvent));
  }

export default function VisitTodos({ allVisits = false }: { allVisits?: boolean }) {
  const stored = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const completed = readCompleted(stored);
  const latestVisit = demoVisits[0];
  const visible = allVisits ? todos : todos.filter((task) => task.visitHref === `/demo/visits#visit-${latestVisit.conversation.sourceId}`);
  const active = visible.filter(({ id }) => !completed.includes(id));
  const done = visible.filter(({ id }) => completed.includes(id));


  function renderTask({ id, title, detail, visitTitle, recordedAt, visitHref, dueBy, approximate, when }: (typeof todos)[number]) {
    const checked = completed.includes(id);
    return <li key={id}>
      <label className={styles.todo}>
        <input type="checkbox" checked={checked} onChange={(event) => toggle(id, event.currentTarget.checked)} />
        <span>
          <span className={`${styles.title}${checked ? ` ${styles.completed}` : ""}`}>{title}</span>
          <span className={styles.detail}>{detail}</span>
          {(dueBy || when) && <span className={styles.timing}>{dueBy ? `${approximate ? "Around" : "Visit target:"} ${dateFormat.format(new Date(`${dueBy}T00:00:00Z`))}${approximate ? " · approximate follow-up timing" : ""}` : when}</span>}
        </span>
      </label>
      {allVisits && <Link className={styles.taskSource} href={visitHref}>{dateFormat.format(new Date(recordedAt))} · {visitTitle} <span aria-hidden="true">→</span></Link>}
    </li>;
  }

  return (
    <section className={`${styles.card}${allVisits ? ` ${styles.fullPage}` : ""}`} aria-labelledby="visit-todos-heading">
      <div className={styles.heading}>
        <h2 id="visit-todos-heading">{allVisits ? "Outstanding" : "Action items from your last visit"}</h2>
        <span className={styles.progress} role="status">{active.length} remaining</span>
      </div>
      <p className={styles.source}>{allVisits ? "Next steps from all your visits." : `${latestVisit.conversation.title} · ${dateFormat.format(new Date(latestVisit.conversation.recordedAt))}`}</p>
      {active.length ? <ul className={styles.list}>{active.map(renderTask)}</ul> : <p className={styles.empty}>{allVisits ? "You’re all caught up." : "No outstanding action items from your last visit."}</p>}
      {allVisits && <details className={styles.completedSection}>
        <summary>Completed ({done.length})</summary>
        <p className={styles.source}>Uncheck a task to move it back to Outstanding.</p>
        {done.length ? <ul className={styles.list}>{done.map(renderTask)}</ul> : <p className={styles.empty}>No completed action items yet.</p>}
      </details>}
      {!allVisits && <Link className={styles.link} href="/demo/todos">See all action items <span aria-hidden="true">→</span></Link>}
    </section>
  );
}
