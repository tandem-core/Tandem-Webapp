"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { decideVisitRequest, requestVisit, useVisitRequests } from "@/lib/visit-requests";
import styles from "./visit-requests.module.css";

type RequestableVisit = { sourceId: string; title: string; recordedAt: string };
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function FamilySharingRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); };
  }, [router]);
  return null;
}

export function RequestVisitList({ visits }: { visits: RequestableVisit[] }) {
  const requests = useVisitRequests();
  return <section className={styles.section} aria-labelledby="request-visits-heading">
    <h2 id="request-visits-heading">Request a visit</h2>
    <p className={styles.description}>Ask Mary to share another visit. Its files stay private until she approves.</p>
    {!visits.length && <p className={styles.description}>All available demo visits have been shared with you.</p>}
    {visits.map((visit) => {
      const request = [...requests].reverse().find((item) => item.sourceId === visit.sourceId);
      return <article className={styles.row} key={visit.sourceId}>
        <div><h3>{visit.title}</h3><p>{dateFormat.format(new Date(visit.recordedAt))}</p>
          {request?.status === "pending" && <p role="status">Requested · waiting for Mary’s approval</p>}
          {request?.status === "declined" && <p role="status">Mary declined this request.</p>}
        </div>
        <button type="button" disabled={request?.status === "pending" || request?.status === "approved"} onClick={() => requestVisit(visit.sourceId, visit.title)}>{request?.status === "pending" ? "Requested" : request?.status === "approved" ? "Approved" : "Request visit"}</button>
      </article>;
    })}
  </section>;
}

export function ParentVisitRequests() {
  const requests = useVisitRequests();
  const router = useRouter();
  const pending = requests.filter((request) => request.status === "pending");
  if (!requests.length) return null;
  return <section className={styles.section} aria-labelledby="family-requests-heading">
    <h2 id="family-requests-heading">Family requests</h2>
    {!pending.length && <p className={styles.description}>No pending visit requests.</p>}
    {pending.map((request) => <article className={styles.row} key={request.id}>
      <div><h3>Lisa Doe requested a visit</h3><Link className={styles.link} href={`/demo/visits#visit-${request.sourceId}`}>{request.title} →</Link><p>Approving shares the recording, recap, transcript, prescriptions, and action items from this visit.</p></div>
      <div className={styles.actions}>
        <button type="button" onClick={() => { decideVisitRequest(request.id, "approved"); router.refresh(); }}>Approve</button>
        <button className={styles.secondary} type="button" onClick={() => { decideVisitRequest(request.id, "declined"); router.refresh(); }}>Decline</button>
      </div>
    </article>)}
    <details className={styles.history}><summary>Request history</summary>{requests.filter((request) => request.status !== "pending").map((request) => <p key={request.id}>{request.title} · {request.status}</p>)}</details>
  </section>;
}
