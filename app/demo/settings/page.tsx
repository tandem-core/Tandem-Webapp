import Icon from "@/components/demo-icon";
import FamilyMembers from "@/components/family-members";
import styles from "./settings.module.css";

export default function Settings() {
  return (
    <main className="home-content" id="main-content">
      <h1>Settings</h1>
      <div className={styles.sections}>
        <section className={styles.card} aria-labelledby="profile-heading">
          <h2 id="profile-heading">Your profile</h2>
          <dl className={styles.profile}>
            <div><dt>Name</dt><dd>Mary Doe</dd></div>
            <div><dt>Email</dt><dd>mary.doe@gmail.com</dd></div>
            <div><dt>Age</dt><dd>65</dd></div>
          </dl>
        </section>

        <FamilyMembers />

        <section className={styles.card} aria-labelledby="devices-heading">
          <h2 id="devices-heading">Connected devices</h2>
          <ul className={styles.list}>
            <li className={styles.device}>
              <span className={styles.deviceIcon}><Icon name="mic" /></span>
              <div className={styles.deviceDetails}>
                <h3>Mary’s Tandem</h3>
              </div>
              <span className={styles.status}><span aria-hidden="true" />Connected</span>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
