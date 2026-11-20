"use client";

import { useState } from "react";
import Link from "next/link";
import type { prescriptionEntries } from "@/lib/prescription-entries";
import styles from "@/app/demo/prescriptions/prescriptions.module.css";
import PrescriptionName from "@/components/prescription-name";
import { medicineExcerpts } from "@/lib/medicine-excerpts";
import { prescriptionNotes } from "@/lib/prescription-notes";
import { familyVoice } from "@/lib/family-demo-config";
import { doseExcerpts } from "@/lib/dose-excerpts";
import { usePrescriptionSearch } from "@/components/prescription-search";
import { matchesPrescription } from "@/lib/prescription-search";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
});

const roleLabels: Record<string, string> = {
  changed: "Dose change discussed",
  started: "New medicine recommended",
  proposed: "Suggested at this visit",
  existing: "Existing medicine",
  discussed: "Discussed at this visit",
  not_chosen: "Option not chosen",
  avoid: "Caution discussed",
  unclear: "Plan needs confirmation",
};

const priority: Record<string, number> = { started: 0, changed: 1, proposed: 2, discussed: 3, existing: 4, not_chosen: 5 };
export default function PrescriptionsList({ entries, visitBase = "/demo/visits", family = false }: { entries: ReturnType<typeof prescriptionEntries>; visitBase?: string; family?: boolean }) {
  const { query, setQuery } = usePrescriptionSearch();
  const [order, setOrder] = useState("newest");
  const filtered = entries.filter(({ medicine }) => matchesPrescription(medicine, query)).sort((a, b) => {
    const byDate = b.conversation.recordedAt.localeCompare(a.conversation.recordedAt);
    const byPriority = (priority[a.medicine.role] ?? 6) - (priority[b.medicine.role] ?? 6);
    return order === "changes" ? byPriority || byDate : (order === "oldest" ? -byDate : byDate) || byPriority;
  });

  return (
    <main className="home-content" id="main-content">
      <div className={styles.pageHeading}>
        <h1>Prescriptions</h1>
      </div>
      <div className={styles.search}>
        <label htmlFor="prescription-search">Search prescriptions</label>
        <input id="prescription-search" type="search" placeholder="Medicine name or dose…" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <p className={styles.intro}>{family ? "Medicines mentioned in the visits Mary shared with you. These are visit notes, not a verified list of current prescriptions. Confirm with Mary’s care team if you are unsure." : "Medicines and recommendations mentioned in your visits. These are visit notes, not a verified list of current prescriptions. Confirm with your doctor if you are unsure."}</p>
      <div className={styles.toolbar}>
        <p role="status">{filtered.length} {filtered.length === 1 ? "medicine" : "medicines"}</p>
        <label htmlFor="prescription-order">Sort by <select id="prescription-order" value={order} onChange={(event) => setOrder(event.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="changes">New medicines &amp; changes first</option>
        </select></label>
      </div>
      <ul className={styles.entries}>
        {filtered.map(({ conversation, medicine, key }) => {
          const unclearName = medicine.nameState === "suggested" || medicine.nameState === "unclear";
          const excerpt = medicineExcerpts[key];
          const doseExcerpt = doseExcerpts[key];
          const label = medicine.role === "proposed" || medicine.role === "discussed" ? "Suggested to try · over the counter" : roleLabels[medicine.role];
          const badgeClassName = medicine.role === "changed" ? styles.changed : medicine.role === "started" ? styles.started : "";
          return <li className={styles.card} key={key}>
            <div className={styles.entryHeading}>
              <div className={styles.name}>
                {unclearName && excerpt ? <PrescriptionName label={label} badgeClassName={badgeClassName} readOnly={family} medicine={{
                  id: `${conversation.sourceId}-${medicine.id}`, heardAs: medicine.heardAs,
                  suggestedName: medicine.suggestion?.name ?? null, audioUrl: excerpt.audioUrl, durationSec: excerpt.durationSec,
                }} /> : <div className={styles.medicineHeading}>
                  <h2>{medicine.rxnorm?.name ?? medicine.heardAs}</h2>
                  <span className={`${styles.badge} ${badgeClassName}`}>{label}</span>
                </div>}
              </div>
              <Link className={styles.visitReference} href={`${visitBase}#visit-${conversation.sourceId}`}>
                <time dateTime={conversation.recordedAt}>{dateFormat.format(new Date(conversation.recordedAt))}</time>
                <span>{conversation.title}<span aria-hidden="true">{ "\u00a0→" }</span></span>
              </Link>
            </div>
            <p className={styles.detail}>{family ? familyVoice(prescriptionNotes[key]) : prescriptionNotes[key]}</p>
            {medicine.doseStatements.length > 0 && <div className={styles.doses}>
              <h3>Dosing mentioned in the recording</h3>
              <ul>{medicine.doseStatements.map((dose, index) => <li key={index}>“{dose.text}”{dose.unclear ? " — unclear; confirm with your care team" : ""}</li>)}</ul>
              {doseExcerpt && <>
                <p className={styles.audioLabel}>{conversation.sourceId === "03_prescription_refill_counseling" ? "Pharmacist’s" : "Doctor’s"} audio · verify dosing ({doseExcerpt.durationSec}s clip)</p>
                <audio className={styles.audio} controls preload="metadata" aria-label={`Verify dosing for ${medicine.heardAs} from ${conversation.title}`}>
                  <source src={doseExcerpt.audioUrl} type="audio/mpeg" />
                  <a href={doseExcerpt.audioUrl}>Listen to dosing clip</a>
                </audio>
              </>}
            </div>}
          </li>;
        })}
      </ul>
      {!filtered.length && <div className={styles.empty}>
        <h2>No matching prescriptions</h2>
        <p>Try a medicine name or dose.</p>
        <button type="button" onClick={() => setQuery("")}>Clear search</button>
      </div>}
    </main>
  );
}
