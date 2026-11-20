"use client";

import Link from "next/link";
import type { demoTodos } from "@/lib/demo-todos";
import { cancelSchedulingHelp, requestSchedulingHelp, updateSchedulingHelp, useSchedulingHelp } from "@/lib/scheduling-help";
import styles from "./scheduling-help.module.css";

type Task = (typeof demoTodos)[number];
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export function SchedulingHelpButton({ task }: { task: Task }) {
  const requests = useSchedulingHelp();
  const request = requests.find((item) => item.taskId === task.id);
  if (!/book|follow.up|appointment|schedul/i.test(task.title)) return null;
  return <div className={styles.parentControl}>
    {request?.status === "requested" ? <><p role="status">Lisa has been asked to help schedule this appointment.</p><button className={styles.secondary} type="button" onClick={() => cancelSchedulingHelp(task.id)}>Cancel request</button></> :
      request?.status === "helping" ? <><p role="status">Lisa is helping schedule this appointment.</p><button className={styles.secondary} type="button" onClick={() => cancelSchedulingHelp(task.id)}>Cancel request</button></> :
      <>{request?.status === "handled" && <p role="status">Lisa marked your scheduling request as handled.</p>}<button type="button" onClick={() => requestSchedulingHelp(task.id)}>Ask Lisa to help schedule</button></>}
  </div>;
}

export function SchedulingHelpAlerts({ tasks }: { tasks: Task[] }) {
  const requests = useSchedulingHelp();
  // Requests must never reveal an unshared task's title, date, or visit context.
  const visible = requests.filter((request) => request.status !== "handled" && tasks.some((task) => task.id === request.taskId));
  if (!visible.length) return null;
  return <section className={styles.alerts} aria-label="Scheduling help requests">
    {visible.map((request) => {
      const task = tasks.find((item) => item.id === request.taskId)!;
      return <article className={styles.alert} key={task.id} role={request.status === "requested" ? "alert" : "status"}>
        <div className={styles.heading}><span className={styles.indicator} aria-hidden="true">!</span><span className={styles.badge}>{request.status === "requested" ? "Help requested" : "You’re helping"}</span></div>
        <h2>Mary is requesting help scheduling {/follow.up/i.test(task.title) ? "a follow-up" : "an appointment"}</h2>
        <p className={styles.context}>From her <strong>{dateFormat.format(new Date(task.recordedAt))}</strong> visit: <strong>{task.visitTitle}</strong>.</p>
        <h3>{task.title}</h3>
        {(task.dueBy || task.when) && <p className={styles.timing}>{task.dueBy ? `${task.approximate ? "Follow-up around" : "Visit target:"} ${dateFormat.format(new Date(`${task.dueBy}T00:00:00Z`))}` : task.when}</p>}
        <Link className={styles.link} href={task.visitHref}>View shared visit →</Link>
        <div className={styles.actions}>
          {request.status === "requested" && <button type="button" onClick={() => updateSchedulingHelp(task.id, "helping")}>I’ll help schedule</button>}
          {request.status === "helping" && <button type="button" onClick={() => updateSchedulingHelp(task.id, "handled")}>Mark as handled</button>}
        </div>
      </article>;
    })}
  </section>;
}
