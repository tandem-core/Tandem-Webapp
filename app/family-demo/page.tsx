import { SchedulingHelpAlerts } from "@/components/scheduling-help";
import Link from "next/link";
import Icon from "@/components/demo-icon";
import ActionItemsList from "@/components/action-items-list";
import { getFamilyData } from "@/lib/family-demo";
import styles from "./family.module.css";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function FamilyHome() {
  const { sharedVisits, sharedActionItems } = await getFamilyData();
  return <main className="home-content" id="main-content">
    <h1 className="home-greeting">Hello, <span style={{ color: "#dc3c44" }}>Lisa</span></h1>
    <p className={styles.intro}>Stay in the loop with your parent, Mary Doe.</p>
    <SchedulingHelpAlerts tasks={sharedActionItems} />
    <section className={styles.banner} aria-label="Sharing overview">
      <span className={styles.avatar} aria-hidden="true">MD</span>
      <div><h2>Shared by Mary</h2><p>Only visits and files Mary has shared with you appear here.</p></div>
    </section>
    {sharedVisits[0] && <ActionItemsList tasks={sharedActionItems} latest={sharedVisits[0]} family />}
    <section className="visits-section" aria-labelledby="shared-visits-heading">
      <h2 id="shared-visits-heading"><Icon name="visit" />Shared visits</h2>
      <div className="visits-list">{sharedVisits.map(({ conversation }) => <Link className="visit-card" key={conversation.id} href={`/family-demo/visits#visit-${conversation.sourceId}`}>
        <span className="visit-copy"><span className="visit-title">{conversation.title}</span><span className="visit-date">{dateFormat.format(new Date(conversation.recordedAt))} · Shared by Mary</span></span><Icon name="chevron" />
      </Link>)}</div>
    </section>
    <Link className={styles.link} href="/family-demo/prescriptions">View shared prescriptions <span aria-hidden="true">→</span></Link>
  </main>;
}
