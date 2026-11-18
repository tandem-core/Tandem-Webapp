import Icon from "@/components/demo-icon";
import Link from "next/link";
import { demoVisits } from "@/lib/demo-visits";
import styles from "./prescriptions.module.css";
import PrescriptionName from "@/components/prescription-name";
import { medicineExcerpts } from "@/lib/medicine-excerpts";
import { prescriptionNotes } from "@/lib/prescription-notes";
import { doseExcerpts } from "@/lib/dose-excerpts";

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

// Keep treatment starts, dose changes, and existing prescribed medicines.
// Retain the heartburn alternative as an explicitly unchosen option.
const prescriptionVisits = demoVisits
  .map((visit) => ({
    ...visit,
    medications: visit.medications.filter((medicine) =>
      ["started", "changed", "existing"].includes(medicine.role) ||
      (visit.conversation.id === "clip:01_medication_shared_decision" && medicine.role === "not_chosen")
    ).sort((a, b) => {
      const priority: Record<string, number> = { started: 0, changed: 1, existing: 2, not_chosen: 3 };
      return (priority[a.role] ?? 4) - (priority[b.role] ?? 4);
    }),
  }));

export default function Prescriptions() {
  return (
    <main className="home-content" id="main-content">
      <h1>Prescriptions</h1>
      <p className={styles.intro}>Medicines and recommendations mentioned in your visits. These are visit notes, not a verified list of current prescriptions. Confirm with your doctor if you are unsure.</p>
      <div className={styles.visits}>
        {prescriptionVisits.map(({ conversation, medications }) => (
          <section className={styles.card} key={conversation.id} aria-labelledby={`medicines-${conversation.sourceId}`}>
            <div className={styles.heading}>
              <span className={styles.icon}><Icon name="prescription" /></span>
              <div>
                <time className={styles.date} dateTime={conversation.recordedAt}>{dateFormat.format(new Date(conversation.recordedAt))}</time>
                <h2 id={`medicines-${conversation.sourceId}`}>{conversation.title}</h2>
              </div>
            </div>
            {medications.length ? <ul className={styles.medicines}>
              {medications.map((medicine) => {
                const unclearName = medicine.nameState === "suggested" || medicine.nameState === "unclear";
                const excerpt = medicineExcerpts[`${conversation.id}/${medicine.id}`];
                const label = roleLabels[medicine.role] ?? "Mentioned at this visit";
                const badgeClassName = medicine.role === "changed" ? styles.changed : medicine.role === "started" ? styles.started : "";
                const doseExcerpt = doseExcerpts[`${conversation.id}/${medicine.id}`];
                return (
                  <li className={styles.medicine} key={medicine.id}>
                    {unclearName && excerpt ? <PrescriptionName label={label} badgeClassName={badgeClassName} medicine={{
                      id: `${conversation.sourceId}-${medicine.id}`,
                      heardAs: medicine.heardAs,
                      suggestedName: medicine.suggestion?.name ?? null,
                      audioUrl: excerpt.audioUrl,
                      durationSec: excerpt.durationSec,
                    }} /> : <div className={styles.medicineHeading}>
                      <h3>{medicine.rxnorm?.name ?? medicine.heardAs}</h3>
                      <span className={`${styles.badge} ${badgeClassName}`}>{label}</span>
                    </div>}
                    <p className={styles.detail}>{prescriptionNotes[`${conversation.id}/${medicine.id}`] ?? "This medicine was mentioned in your visit. Review the visit notes for details."}</p>
                    {medicine.doseStatements.length > 0 && <div className={styles.doses}>
                      <h4>Dosing mentioned in the recording</h4>
                      <ul>{medicine.doseStatements.map((dose, index) => <li key={index}>“{dose.text}”{dose.unclear ? " — unclear; confirm with your care team" : ""}</li>)}</ul>
                      {doseExcerpt && <>
                        <p className={styles.audioLabel}>{conversation.sourceId === "03_prescription_refill_counseling" ? "Pharmacist’s" : "Doctor’s"} audio · verify dosing ({doseExcerpt.durationSec}s clip)</p>
                        <audio className={styles.audio} controls preload="metadata" aria-label={`Verify dosing for ${medicine.heardAs} from ${conversation.title}`}>
                          <source src={doseExcerpt.audioUrl} type="audio/mpeg" />
                          <a href={doseExcerpt.audioUrl}>Listen to dosing clip</a>
                        </audio>
                      </>}
                    </div>}
                  </li>
                );
              })}
            </ul> : <p className={styles.noMedicines}>No prescriptions recorded for this visit.</p>}
            <Link className={styles.link} href={`/demo/visits#visit-${conversation.sourceId}`}>View visit notes <span aria-hidden="true">→</span></Link>
          </section>
        ))}
      </div>
    </main>
  );
}
