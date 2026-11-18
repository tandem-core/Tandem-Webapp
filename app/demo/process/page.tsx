"use client";

import { useCallback, useEffect, useState } from "react";
import { demoVisits } from "@/lib/demo-visits";
import styles from "./process.module.css";

type Clip = { file: string; start: number; end: number };
type Claim = { id: string; detail: string; evidence: number[]; clips: Clip[] };
type Medicine = Claim & { heardAs: string; suggestedName: string | null; nameState: string; role: string; doses: (Claim & { text: string })[] };
type Job = { id: string; title: string; mode: string; status: string; stage: string; error?: string; result?: { summary: string; medications: Medicine[]; actionItems: (Claim & { title: string; timing: string | null })[]; segments: { idx: number; start: number; end: number; text: string }[] } };
const labels: Record<string, string> = { new_recommended: "New treatment recommended", dose_change: "Dose change", existing: "Existing medicine", otc_suggestion: "Over-the-counter suggestion", not_chosen: "Option not chosen", past_error: "Past error · not a current prescription", mentioned: "Mentioned only" };

export default function ProcessRecording() {
  const [source, setSource] = useState(demoVisits[0].conversation.sourceId);
  const [mode, setMode] = useState("live");
  const [file, setFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/processing/jobs");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setError("");
    setJobs(data.jobs);
    if (selected) {
      const detail = await fetch(`/api/processing/jobs/${selected}`);
      const result = await detail.json();
      if (!detail.ok) throw new Error(result.error);
      setJob(result);
    }
  }, [selected]);
  useEffect(() => {
    let cancelled = false;
    const poll = () => refresh().catch((reason) => { if (!cancelled) setError(reason.message); });
    void poll();
    const timer = setInterval(poll, 2500);
    return () => { cancelled = true; clearInterval(timer); };
  }, [refresh]);

  async function processRecording() {
    setError(""); setBusy(true); setJob(null);
    try {
      if (source === "upload" && !file) throw new Error("Choose an audio recording first.");
      if (file && source === "upload" && file.size > 24 * 1024 * 1024) throw new Error("Use a recording smaller than 24 MB.");
      const params = new URLSearchParams({ mode: source === "upload" ? "live" : mode });
      if (source !== "upload") params.set("demo", `clip_${source}`);
      params.set("title", source === "upload" ? file!.name : demoVisits.find((visit) => visit.conversation.sourceId === source)!.conversation.title);
      const response = await fetch(`/api/processing/jobs?${params}`, { method: "POST", body: source === "upload" ? file : "demo" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSelected(result.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not process recording."); }
    finally { setBusy(false); }
  }

  function evidence(claim: Claim) {
    return <div className={styles.evidence}>
      <details><summary>Supporting transcript</summary>{claim.evidence.map((idx) => {
        const segment = job?.result?.segments.find((item) => item.idx === idx);
        return segment ? <p key={idx}>{Math.floor(segment.start / 60)}:{String(Math.floor(segment.start % 60)).padStart(2, "0")} · {segment.text}</p> : null;
      })}</details>
      {claim.clips?.map((clip) => <audio key={clip.file} controls preload="none" aria-label="Listen to supporting recording" src={`/api/processing/jobs/${job!.id}/${clip.file}`} />)}
    </div>;
  }

  return <main className="home-content" id="main-content">
    <h1>Process a recording</h1>
    <p className={styles.intro}>Create a transcript, medicines, and action items from an audio recording. Results are drafts for review and are saved separately from the existing demo visits.</p>
    <section className={styles.card} aria-label="Recording input">
      <label htmlFor="recording-source">Recording</label>
      <select id="recording-source" value={source} onChange={(event) => setSource(event.target.value)}>
        {demoVisits.map(({ conversation }) => <option key={conversation.sourceId} value={conversation.sourceId}>{conversation.title}</option>)}
        <option value="upload">Upload another recording</option>
      </select>
      {source === "upload" ? <input type="file" accept="audio/*" aria-label="Audio recording" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /> : <>
        <label htmlFor="processing-mode">Processing mode</label>
        <select id="processing-mode" value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="live">Fresh AI transcription &amp; extraction (requires API key)</option>
          <option value="replay">Replay prepared demo data (no AI run)</option>
        </select>
      </>}
      <button type="button" disabled={busy} onClick={processRecording}>{busy ? "Submitting…" : source !== "upload" && mode === "replay" ? "Replay demo recording" : "Process recording"}</button>
      <p className={styles.hint}>Live mode sends audio and transcript to OpenAI. Local prototype: start the Python service with npm run pipeline:serve.</p>
    </section>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <section className={styles.card} aria-label="Saved processing runs">
      <h2>Saved recordings</h2>
      {!jobs.length && <p>No processed recordings yet.</p>}
      {jobs.map((item) => <button className={styles.job} type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setJob(null); setError(""); }}>{item.title} · {item.status}{item.mode === "replay" ? " · replay" : ""}</button>)}
    </section>
    {job && <section className={styles.card} aria-label="Processing result">
      <h2>{job.title}</h2>
      <p role="status">{job.stage}</p>
      {job.mode === "replay" && <p className={styles.notice}>Prepared demo replay. This result does not measure transcription or extraction model accuracy.</p>}
      {job.error && <p className={styles.error} role="alert">{job.error}</p>}
      {job.result && <>
        <h3>Visit summary</h3><p>{job.result.summary}</p>
        <h3>Medicines</h3>
        {!job.result.medications.length && <p>No medicines extracted.</p>}
        {job.result.medications.map((medicine) => <article className={styles.item} key={medicine.id}>
          <h4>{medicine.heardAs} <span className={styles.badge}>{labels[medicine.role]}</span></h4>
          {medicine.nameState === "unverified" && <p className={styles.notice}>Tandem could not verify this medicine’s name.{medicine.suggestedName ? ` Possible name: ${medicine.suggestedName}.` : ""}</p>}
          <p>{medicine.detail}</p>{evidence(medicine)}
          {medicine.doses.map((dose, index) => <div key={index}><h4>Dosing heard: “{dose.text}”</h4>{evidence(dose)}</div>)}
        </article>)}
        <h3>Action items</h3>
        {!job.result.actionItems.length && <p>No action items extracted.</p>}
        {job.result.actionItems.map((item) => <article className={styles.item} key={item.id}><h4>{item.title}</h4><p>{item.detail}</p>{item.timing && <p>{item.timing}</p>}{evidence(item)}</article>)}
      </>}
    </section>}
  </main>;
}
