"use client";

import { useState } from "react";
import MedicineNameCheck, { type Answer, type UnclearMedicine } from "@/components/medicine-name-check";
import styles from "@/app/demo/prescriptions/prescriptions.module.css";

export default function PrescriptionName({ medicine, label, badgeClassName = "" }: { medicine: UnclearMedicine; label: string; badgeClassName?: string }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const confirmed = answer?.kind === "confirmed" || answer?.kind === "corrected";
  return <>
    <div className={styles.medicineHeading}>
      <h3>{confirmed ? answer.name : "Medicine name needs confirmation"}</h3>
      <span className={`${styles.badge} ${badgeClassName}`}>{label}</span>
    </div>
    <MedicineNameCheck medicines={[medicine]} onAnswer={setAnswer} />
  </>;
}
