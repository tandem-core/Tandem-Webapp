"use client";

import { useRef, useState } from "react";
import Link from "next/link";

function Icon({ name, className = "" }: { name: "mic" | "chat" | "visit" | "home" | "chevron"; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "mic" && <><rect x="11" y="3" width="10" height="18" rx="5" /><path d="M6.5 15v2a9.5 9.5 0 0 0 19 0v-2M16 26.5V31M11 31h10" /></>}
      {name === "chat" && <path d="M28 14.5a12 12 0 0 1-17.5 10.7L3 28l2.8-7.3A12 12 0 1 1 28 14.5Z" />}
      {name === "visit" && <><rect x="7" y="3" width="18" height="26" rx="3" /><path d="M12 9h8M12 14h8M12 19h5" /></>}
      {name === "home" && <><path d="m3 14 13-11 13 11M6 12v17h7V19h6v10h7V12" /></>}
      {name === "chevron" && <path d="m12 7 9 9-9 9" />}
    </svg>
  );
}

export default function Home() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState({ title: "", body: "" });

  function showPreview(title: string, body: string) {
    setMessage({ title, body });
    dialog.current?.showModal();
  }

  return (
    <div className="app-shell">
      <header className="app-header"><Link href="/" className="wordmark" aria-label="Tandem home">Tandem</Link></header>
      <main className="home-content" id="main-content">
        <h1>Good morning,<br />Mary.</h1>
        <div className="home-actions">
          <button className="action-card record-action" onClick={() => showPreview("Record a visit", "Visit recording is coming next. This preview does not record audio.")}>
            <span className="microphone-circle"><Icon name="mic" /></span><span>Record a visit</span>
          </button>
          <button className="action-card ask-action" onClick={() => showPreview("Ask Tandem", "A place to ask questions about your visits is coming soon.")}>
            <span className="chat-icon"><Icon name="chat" /></span><span>Ask Tandem</span>
          </button>
        </div>
        <section className="visits-section" id="visits" aria-labelledby="visits-heading">
          <h2 id="visits-heading"><Icon name="visit" />Your visits</h2>
          <button className="visit-card" onClick={() => showPreview("Heartburn medicine review", "Nov 3 · Dr. Smith. This is a sample visit. Visit summaries will be added in a future step.")}>
            <span className="visit-copy"><span className="visit-title">Heartburn medicine review</span><span className="visit-date">Nov 3 · Dr. Smith</span></span>
            <Icon name="chevron" />
          </button>
        </section>
      </main>
      <nav className="bottom-nav" aria-label="Main navigation">
        <Link className="nav-item active" href="/" aria-current="page"><Icon name="home" /><span>Home</span></Link>
        <a className="nav-item" href="#visits"><Icon name="visit" /><span>Visits</span></a>
      </nav>
      <dialog ref={dialog} className="preview-dialog" aria-labelledby="preview-title">
        <h2 id="preview-title">{message.title}</h2><p>{message.body}</p>
        <form method="dialog"><button className="dialog-close">Got it</button></form>
      </dialog>
    </div>
  );
}
