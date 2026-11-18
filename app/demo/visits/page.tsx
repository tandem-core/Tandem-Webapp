import Link from "next/link";
import Icon from "@/components/demo-icon";
import { demoVisits } from "@/lib/demo-visits";
import MedicineNameCheck from "@/components/medicine-name-check";
import { medicineExcerpts } from "@/lib/medicine-excerpts";
import ShareVisit from "@/components/share-visit";

function timestamp(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
});

export default function Visits() {
  return (
    <main className="home-content" id="main-content">
      <h1>Visits</h1>
      <Link href="/demo/process" className="read-aloud-button" style={{ marginTop: 20 }}>Process a recording</Link>
      <div className="recordings-list">
        {demoVisits.map(({ conversation, summary, medications, audioUrl }) => (
          <article className="recording-card" id={`visit-${conversation.sourceId}`} key={conversation.id}>
            <div className="recording-heading">
              <span className="recording-icon"><Icon name="visit" /></span>
              <div>
                <h2>{conversation.title}</h2>
                <p className="recording-meta">
                  <time dateTime={conversation.recordedAt}>{dateFormat.format(new Date(conversation.recordedAt))}</time>
                </p>
              </div>
            </div>
            <audio controls preload="none" aria-label={`Listen to ${conversation.title}`}>
              <source src={audioUrl} type="audio/mpeg" />
              <a href={audioUrl}>Download recording</a>
            </audio>
            <MedicineNameCheck
              medicines={medications.filter((medicine) => medicine.nameState === "suggested" || medicine.nameState === "unclear").map((medicine) => {
                const excerpt = medicineExcerpts[`${conversation.id}/${medicine.id}`];
                return {
                  id: medicine.id,
                  heardAs: medicine.heardAs,
                  suggestedName: medicine.suggestion?.name ?? null,
                  audioUrl: excerpt.audioUrl,
                  durationSec: excerpt.durationSec,
                };
              })}
            />
            <details className="recording-details">
              <summary>Visit recap</summary>
              <div className="recording-detail-body">
                <p>{summary}</p>
              </div>
            </details>
            <details className="recording-details">
              <summary>Transcript</summary>
              <div className="transcript-segments" tabIndex={0} role="region" aria-label={`${conversation.title} transcript`}>
                {conversation.segments.map((segment) => (
                  <p key={segment.idx}><span className="transcript-time">{timestamp(segment.start)}</span><span>{segment.text}</span></p>
                ))}
              </div>
            </details>
            <ShareVisit title={conversation.title} summary={summary} visitId={`visit-${conversation.sourceId}`} />
          </article>
        ))}
      </div>
    </main>
  );
}
