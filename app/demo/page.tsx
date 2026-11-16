"use client";

import { useRef, useState } from "react";
import Icon from "@/components/demo-icon";


export default function Demo() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState({ title: "", body: "" });

  function showPreview(title: string, body: string) {
    setMessage({ title, body });
    dialog.current?.showModal();
  }

  return (
    <>
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
      <dialog ref={dialog} className="preview-dialog" aria-labelledby="preview-title">
        <h2 id="preview-title">{message.title}</h2><p>{message.body}</p>
        <form method="dialog"><button className="dialog-close">Got it</button></form>
      </dialog>
    </>
  );
}
