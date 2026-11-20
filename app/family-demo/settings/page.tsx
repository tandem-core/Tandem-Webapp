import { familyProfile, getFamilyData } from "@/lib/family-demo";
import styles from "@/app/demo/settings/settings.module.css";

export default async function FamilySettings() {
  const { sharedVisits } = await getFamilyData();
  return <main className="home-content" id="main-content"><h1>Settings</h1><div className={styles.sections}>
    <section className={styles.card} aria-labelledby="family-profile-heading"><h2 id="family-profile-heading">Your profile</h2><dl className={styles.profile}>
      <div><dt>Name</dt><dd>{familyProfile.name}</dd></div><div><dt>Email</dt><dd>{familyProfile.email}</dd></div><div><dt>Relationship</dt><dd>{familyProfile.relationship}</dd></div>
    </dl></section>
    <section className={styles.card} aria-labelledby="parent-heading"><h2 id="parent-heading">Your parent</h2><dl className={styles.profile}>
      <div><dt>Name</dt><dd>{familyProfile.parentName}</dd></div><div><dt>Email</dt><dd>{familyProfile.parentEmail}</dd></div>
    </dl></section>
    <section className={styles.card} aria-labelledby="family-access-heading"><h2 id="family-access-heading">Shared with you</h2>
      <p className={styles.description}>{sharedVisits.length} visits, including their recordings, recaps, transcripts, prescriptions, and action items.</p>
      <p className={styles.description}>Mary chooses what to share. You can view shared information here; profile details, medicine confirmations, and action-item completion are managed by Mary.</p>
    </section>
  </div></main>;
}
