import DemoSidebar from "@/components/demo-sidebar";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <DemoSidebar />
      <div className="demo-workspace">{children}</div>
    </div>
  );
}
