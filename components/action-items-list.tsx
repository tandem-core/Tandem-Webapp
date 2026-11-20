"use client";

import { familyVoice } from "@/lib/family-demo-config";
import { SchedulingHelpButton } from "@/components/scheduling-help";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { demoVisits } from "@/lib/demo-visits";
import type { demoTodos } from "@/lib/demo-todos";
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

export default function ActionItemsList({ allVisits = false, tasks, latest, family = false }: { allVisits?: boolean; tasks: typeof demoTodos; latest?: (typeof demoVisits)[number]; family?: boolean }) {
  const stored = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const completed = readCompleted(stored);
  const latestVisit = latest;
  const base = family ? "/family-demo" : "/demo";
  const visible = allVisits ? tasks : tasks.filter((task) => latestVisit && task.visitHref === `${base}/visits#visit-${latestVisit.conversation.sourceId}`);
  const active = visible.filter(({ id }) => !completed.includes(id));
  const done = visible.filter(({ id }) => completed.includes(id));


  function renderTask({ id, title, detail, visitTitle, recordedAt, visitHref, dueBy, approximate, when }: (typeof demoTodos)[number]) {
    const checked = completed.includes(id);
    return <li key={id}>
      <label className={styles.todo}>
        <input type="checkbox" checked={checked} disabled={family} aria-label={family ? `${title}: ${checked ? "completed" : "outstanding"}, managed by Mary` : undefined} onChange={(event) => toggle(id, event.currentTarget.checked)} />
        <span>
          <span className={`${styles.title}${checked ? ` ${styles.completed}` : ""}`}>{title}</span>
          <span className={styles.detail}>{family ? familyVoice(detail) : detail}</span>
          {(dueBy || when) && <span className={styles.timing}>{dueBy ? `${approximate ? "Around" : "Visit target:"} ${dateFormat.format(new Date(`${dueBy}T00:00:00Z`))}${approximate ? " · approximate follow-up timing" : ""}` : when}</span>}
        </span>
      </label>
      {!family && !checked && <SchedulingHelpButton task={tasks.find((task) => task.id === id)!} />}
      {allVisits && <Link className={styles.taskSource} href={visitHref}>{dateFormat.format(new Date(recordedAt))} · {visitTitle} <span aria-hidden="true">→</span></Link>}
    </li>;
  }

  return (
    <section className={`${styles.card}${allVisits ? ` ${styles.fullPage}` : ""}`} aria-labelledby="visit-todos-heading">
      <div className={styles.heading}>
        <h2 id="visit-todos-heading">{allVisits ? "Outstanding" : family ? "From Mary’s latest shared visit" : "Action items from your last visit"}</h2>
        <span className={styles.progress} role="status">{active.length} remaining</span>
      </div>
      <p className={styles.source}>{allVisits ? family ? "Mary’s action items from shared visits. Completion is managed by Mary." : "Next steps from all your visits." : latestVisit ? `${latestVisit.conversation.title} · ${dateFormat.format(new Date(latestVisit.conversation.recordedAt))}` : "No shared visits yet."}</p>
      {active.length ? <ul className={styles.list}>{active.map(renderTask)}</ul> : <p className={styles.empty}>{allVisits ? "You’re all caught up." : "No outstanding action items from your last visit."}</p>}
      {allVisits && <details className={styles.completedSection}>
        <summary>Completed ({done.length})</summary>
        <p className={styles.source}>{family ? "Items Mary has marked as complete." : "Uncheck a task to move it back to Outstanding."}</p>
        {done.length ? <ul className={styles.list}>{done.map(renderTask)}</ul> : <p className={styles.empty}>No completed action items yet.</p>}
      </details>}
      {!allVisits && <Link className={styles.link} href={`${base}/todos`}>See all action items <span aria-hidden="true">→</span></Link>}
    </section>
  );
}
