import DemoSidebar from "@/components/demo-sidebar";
import { PrescriptionSearchProvider } from "@/components/prescription-search";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrescriptionSearchProvider><div className="app-shell">
      <DemoSidebar />
      <div className="demo-workspace">{children}</div>
    </div></PrescriptionSearchProvider>
  );
}
