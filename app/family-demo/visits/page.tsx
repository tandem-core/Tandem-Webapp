import { RequestVisitList } from "@/components/visit-requests";
import { familyVoice } from "@/lib/family-demo-config";
import { getFamilyData } from "@/lib/family-demo";
import Icon from "@/components/demo-icon";
import styles from "../family.module.css";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
function time(seconds: number) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`; }

export default async function SharedVisits() {
  const { sharedVisits, requestableVisits } = await getFamilyData();
  return <main className="home-content" id="main-content">
    <h1>Shared visits</h1>
    <p className={styles.intro}>Recordings, recaps, and transcripts Mary has shared with you.</p>
    <div className="recordings-list">{sharedVisits.map(({ conversation, summary, audioUrl }) => <article className="recording-card" id={`visit-${conversation.sourceId}`} key={conversation.id}>
      <div className="recording-heading"><span className="recording-icon"><Icon name="visit" /></span><div>
        <h2>{conversation.title}</h2><p className="recording-meta"><time dateTime={conversation.recordedAt}>{dateFormat.format(new Date(conversation.recordedAt))}</time> · Shared by Mary</p>
      </div></div>
      <audio controls preload="none" aria-label={`Mary’s shared recording: ${conversation.title}`}><source src={audioUrl} type="audio/mpeg" /><a href={audioUrl}>Download shared recording</a></audio>
      <details className="recording-details" open><summary>Visit recap</summary><div className="recording-detail-body"><p>{familyVoice(summary)}</p></div></details>
      <details className="recording-details"><summary>Transcript</summary><div className="transcript-segments" tabIndex={0} role="region" aria-label={`${conversation.title} shared transcript`}>
        {conversation.segments.map((segment) => <p key={segment.idx}><span className="transcript-time">{time(segment.start)}</span><span>{segment.text}</span></p>)}
      </div></details>
    </article>)}</div>
    <RequestVisitList visits={requestableVisits} />
    {!sharedVisits.length && <p className={styles.intro}>Mary hasn’t shared any visits yet.</p>}
  </main>;
}
