"use client";

import { useRef, useState } from "react";
import styles from "./medicine-name-check.module.css";

export type UnclearMedicine = {
  id: string;
  heardAs: string;
  suggestedName: string | null;
  audioUrl: string;
  durationSec: number;
};

export type Answer = { kind: "confirmed" | "corrected" | "unsure"; name: string };

export default function MedicineNameCheck({ medicines, onAnswer }: { medicines: UnclearMedicine[]; onAnswer?: (answer: Answer) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [selected, setSelected] = useState<UnclearMedicine | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState("");
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState("");

  function open(medicine: UnclearMedicine) {
    setSelected(medicine);
    setCorrecting(false);
    setCorrection("");
    setAudioError("");
    dialog.current?.showModal();
  }

  function stopAudio() {
    audio.current?.pause();
    setPlaying(false);
  }

  function answer(kind: Answer["kind"], name: string) {
    if (!selected) return;
    setAnswers((previous) => ({ ...previous, [selected.id]: { kind, name } }));
    onAnswer?.({ kind, name });
    stopAudio();
    dialog.current?.close();
  }

  async function playExcerpt() {
    if (!audio.current || !selected) return;
    if (playing) { stopAudio(); return; }
    try {
      setAudioError("");
      audio.current.currentTime = 0;
      await audio.current.play();
    } catch {
      setAudioError("The recording could not play. Please try again.");
    }
  }

  if (medicines.length === 0) return null;

  return (
    <section className={styles["medicine-checks"]} aria-label="Medicine names to check">
      <h3>Check medicine names</h3>
      {medicines.map((medicine) => {
        const response = answers[medicine.id];
        return (
          <button className={styles["medicine-check-row"]} key={medicine.id} onClick={() => open(medicine)}>
            <span><strong>{response?.kind === "corrected" ? response.name : medicine.suggestedName || medicine.heardAs}</strong>
              <span className={styles["medicine-check-status"]}>{response?.kind === "confirmed" ? "Name confirmed by you" : response?.kind === "corrected" ? "Name updated by you" : response?.kind === "unsure" ? "Name remains unconfirmed" : "Name unclear · review recording"}</span>
            </span>
            <span className={styles["medicine-review-label"]}>Review <span aria-hidden="true">›</span></span>
          </button>
        );
      })}
      <dialog className={styles["medicine-dialog"]} ref={dialog} aria-labelledby="medicine-dialog-title" onClose={stopAudio}>
        <div className={styles["medicine-dialog-header"]}>
          <button className={styles["medicine-back"]} aria-label="Close without making a choice" onClick={() => dialog.current?.close()}>×</button>
          <h2 id="medicine-dialog-title">Check medicine name</h2>
        </div>
        {selected && <>
          <div className={styles["medicine-warning"]}><span aria-hidden="true">⚠</span><p>We couldn’t clearly hear this medicine’s name.</p></div>
          <p className={styles["medicine-field-label"]}>{selected.suggestedName ? "Possible medicine name" : "What Tandem heard"}</p>
          <div className={styles["medicine-name"]}>{selected.suggestedName || selected.heardAs}</div>
          {selected.suggestedName && <p className={styles["medicine-heard"]}>Heard in the recording as “{selected.heardAs}”.</p>}
          <button className={styles["medicine-listen"]} onClick={playExcerpt} aria-pressed={playing}>
            <span className={styles["medicine-play"]} aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
            {playing ? "Pause clip" : "Listen to the clip"} (0:{String(selected.durationSec).padStart(2, "0")})
          </button>
          <audio key={selected.id} ref={audio} src={selected.audioUrl} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
          {audioError && <p className={styles["medicine-audio-error"]} role="alert">{audioError}</p>}
          {correcting ? (
            <form className={styles["medicine-answers"]} onSubmit={(event) => { event.preventDefault(); if (correction.trim()) answer("corrected", correction.trim()); }}>
              <label htmlFor={`correction-${selected.id}`}>What is the medicine’s name?</label>
              <input id={`correction-${selected.id}`} value={correction} onChange={(event) => setCorrection(event.target.value)} placeholder="Enter the name" required />
              <button className={`${styles["medicine-answer"]} ${styles.primary}`} disabled={!correction.trim()}>Save name</button>
              <button type="button" className={styles["medicine-answer"]} onClick={() => answer("unsure", "")}>I’m not sure</button>
            </form>
          ) : (
            <div className={styles["medicine-answers"]}>
              <p>Does this sound right?</p>
              <button className={`${styles["medicine-answer"]} ${styles.primary}`} onClick={() => answer("confirmed", selected.suggestedName || selected.heardAs)}>Yes, this is the name</button>
              <button className={styles["medicine-answer"]} onClick={() => setCorrecting(true)}>No, it’s not right</button>
              <button className={styles["medicine-answer"]} onClick={() => answer("unsure", "")}>I’m not sure</button>
            </div>
          )}
        </>}
      </dialog>
    </section>
  );
}
