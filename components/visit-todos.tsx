"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./visit-todos.module.css";

const todos = [
  {
    id: "lower-dose-trial",
    title: "Two-week lower-dose trial",
    detail: "Follow the lower-dose plan agreed with Dr. Smith for your heartburn medicine. Confirm the medicine’s name with your care team—it was unclear in the recording.",
  },
  {
    id: "book-follow-up",
    title: "Schedule a follow-up with Dr. Smith",
    detail: "The visit plan suggested a follow-up in about a month. Contact the office sooner if heartburn returns and bothers you for more than a few days.",
  },
];

export default function VisitTodos() {
  const [completed, setCompleted] = useState<string[]>([]);

  return (
    <section className={styles.card} aria-labelledby="visit-todos-heading">
      <div className={styles.heading}>
        <h2 id="visit-todos-heading">To-do from your last visit</h2>
        <span className={styles.progress} aria-live="polite">{completed.length} of {todos.length} done</span>
      </div>
      <p className={styles.source}>Heartburn medicine review · Dr. Smith</p>
      <ul className={styles.list}>
        {todos.map(({ id, title, detail }) => (
          <li key={id}>
            <label className={styles.todo}>
              <input type="checkbox" checked={completed.includes(id)} onChange={(event) => {
                const checked = event.currentTarget.checked;
                setCompleted((current) => checked ? [...current, id] : current.filter((item) => item !== id));
              }} />
              <span>
                <span className={`${styles.title}${completed.includes(id) ? ` ${styles.completed}` : ""}`}>{title}</span>
                <span className={styles.detail}>{detail}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <Link className={styles.link} href="/demo/visits#visit-01_medication_shared_decision">View visit details <span aria-hidden="true">→</span></Link>
    </section>
  );
}
