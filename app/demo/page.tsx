"use client";

import { useRef, useState } from "react";
import Icon from "@/components/demo-icon";
import { demoVisits } from "@/lib/demo-visits";
import ShareVisit from "@/components/share-visit";

const visitDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const visitClinicians: Record<string, string> = {
  "clip:01_medication_shared_decision": "Dr. Smith",
  "clip:02_methotrexate_full_consultation": "Dr. Srivastava",
  "clip:03_prescription_refill_counseling": "Pharmacist",
  "clip:05_anticoagulant_medication_error": "Dr. Adam",
  "clip:06_three_party_screening_consultation": "Emma",
};

const visitTitleOverrides: Record<string, string> = {
  "clip:01_medication_shared_decision": "Heartburn medicine review",
};

export default function Demo() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState<{
    title: string;
    body: string;
    isVisit?: boolean;
    summary?: string;
    visitId?: string;
  }>({ title: "", body: "", isVisit: false });
  const [isReading, setIsReading] = useState(false);

  function stopReading() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsReading(false);
  }

  function showPreview(
    title: string,
    body: string,
    isVisit = false,
    summary = "",
    visitId = ""
  ) {
    stopReading();
    setMessage({ title, body, isVisit, summary, visitId });
    dialog.current?.showModal();
  }

  function handleReadAloud() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isReading) {
      stopReading();
      return;
    }

    window.speechSynthesis.cancel();
    const textToRead = message.summary || message.body;
    if (!textToRead) return;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.rate = 0.95;
    utterance.onend = () => setIsReading(false);
    utterance.onerror = () => setIsReading(false);

    setIsReading(true);
    window.speechSynthesis.speak(utterance);
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
          <div className="visits-list">
            {demoVisits.map(({ conversation, summary }) => {
              const title = visitTitleOverrides[conversation.id] ?? conversation.title;
              const clinician = visitClinicians[conversation.id];
              const formattedDate = visitDateFormat.format(new Date(conversation.recordedAt));
              const dateText = clinician ? `${formattedDate} · ${clinician}` : formattedDate;
              const previewBody = summary
                ? `${dateText}. ${summary}`
                : `${dateText}. This is a sample visit. Visit summaries will be added in a future step.`;

              return (
                <button
                  key={conversation.id}
                  className="visit-card"
                  onClick={() =>
                    showPreview(
                      title,
                      previewBody,
                      true,
                      summary,
                      `visit-${conversation.sourceId}`
                    )
                  }
                >
                  <span className="visit-copy">
                    <span className="visit-title">{title}</span>
                    <span className="visit-date">{dateText}</span>
                  </span>
                  <Icon name="chevron" />
                </button>
              );
            })}
          </div>
        </section>
      </main>
      <dialog ref={dialog} className="preview-dialog" aria-labelledby="preview-title" onClose={stopReading}>
        <h2 id="preview-title">{message.title}</h2>
        <p>{message.body}</p>
        {message.isVisit && (
          <ShareVisit
            title={message.title}
            summary={message.summary || message.body}
            visitId={message.visitId || ""}
          />
        )}
        <div className="preview-dialog-actions">
          {message.isVisit && (
            <button
              type="button"
              className={`read-aloud-button${isReading ? " reading" : ""}`}
              onClick={handleReadAloud}
              aria-label={isReading ? "Stop reading summary aloud" : "Read visit summary aloud"}
            >
              <Icon name="volume" />
              <span>{isReading ? "Stop reading" : "Read aloud"}</span>
            </button>
          )}
          <form method="dialog"><button className="dialog-close">Got it</button></form>
        </div>
      </dialog>
    </>
  );
}
