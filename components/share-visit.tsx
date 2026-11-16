"use client";

import { useRef, useState } from "react";
import styles from "./share-visit.module.css";

export default function ShareVisit({ title, summary, visitId }: { title: string; summary: string; visitId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");
  const [sharing, setSharing] = useState(false);

  async function share() {
    const link = new URL(`/demo/visits#${visitId}`, window.location.origin).href;
    setUrl(link);
    setStatus("");
    if (navigator.share) {
      try {
        setSharing(true);
        await navigator.share({ title, text: summary, url: link });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      } finally {
        setSharing(false);
      }
    }
    dialog.current?.showModal();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied.");
    } catch {
      setStatus("Select and copy the link below.");
    }
  }

  return (
    <section className={styles.section} aria-label={`Share ${title} with my family`}>
      <span>Share with my family</span>
      <button className={styles.send} onClick={share} disabled={sharing} aria-label={`Share this visit: ${title}`} title="Share this visit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z" /><path d="m22 2-11 11" /></svg>
      </button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={`share-title-${visitId}`}>
        <div className={styles.header}>
          <button className={styles.close} onClick={() => dialog.current?.close()} aria-label="Close sharing">×</button>
          <h2 id={`share-title-${visitId}`}>Share with my family</h2>
        </div>
        <h3>{title}</h3>
        <p>{summary}</p>
        <label className={styles.label} htmlFor={`share-link-${visitId}`}>Visit link</label>
        <input id={`share-link-${visitId}`} className={styles.link} value={url} readOnly onFocus={(event) => event.currentTarget.select()} />
        <div className={styles.actions}>
          <button className={styles.copy} onClick={copyLink}>Copy link</button>
          <a className={styles.email} href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${summary}\n\n${url}`)}`}>Share by email</a>
        </div>
        <p className={styles.status} role="status">{status}</p>
      </dialog>
    </section>
  );
}
