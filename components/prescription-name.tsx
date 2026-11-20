"use client";

import { useState } from "react";
import MedicineNameCheck, { type Answer, type UnclearMedicine } from "@/components/medicine-name-check";
import styles from "@/app/demo/prescriptions/prescriptions.module.css";

export default function PrescriptionName({ medicine, label, badgeClassName = "", readOnly = false }: { medicine: UnclearMedicine; label: string; badgeClassName?: string; readOnly?: boolean }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const confirmed = answer?.kind === "confirmed" || answer?.kind === "corrected";
  return <>
    <div className={styles.medicineHeading}>
      <h3>{confirmed ? answer.name : "Medicine name needs confirmation"}</h3>
      <span className={`${styles.badge} ${badgeClassName}`}>{label}</span>
    </div>
    {readOnly ? <div>
      <p className={styles.confirm}>Tandem could not verify the name. Heard as “{medicine.heardAs}”. Confirm with Mary and her care team.</p>
      <audio className={styles.audio} controls preload="none" aria-label="Listen to the medicine name" src={medicine.audioUrl} />
    </div> : <MedicineNameCheck medicines={[medicine]} onAnswer={setAnswer} />}
  </>;
}
