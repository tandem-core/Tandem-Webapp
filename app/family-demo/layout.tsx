import { Suspense } from "react";
import { FamilySharingRefresh } from "@/components/visit-requests";
import DemoSidebar from "@/components/demo-sidebar";
import { PrescriptionSearchProvider } from "@/components/prescription-search";

export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  return <PrescriptionSearchProvider><div className="app-shell">
    <DemoSidebar family />
    <div className="demo-workspace"><FamilySharingRefresh /><Suspense fallback={<p>Loading shared visits…</p>}>{children}</Suspense></div>
  </div></PrescriptionSearchProvider>;
}
