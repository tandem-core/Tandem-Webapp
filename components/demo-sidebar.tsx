"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/demo-icon";

const links = [
  { href: "/demo", label: "Home", icon: "home" },
  { href: "/demo/visits", label: "Visits", icon: "visit" },
  { href: "/demo/todos", label: "Action items", icon: "todo" },
  { href: "/demo/prescriptions", label: "Prescriptions", icon: "prescription" },
  { href: "/demo/settings", label: "Settings", icon: "settings" },
] as const;

export default function DemoSidebar() {
  const pathname = usePathname();

  return (
    <aside className="demo-sidebar">
      <Link href="/" className="wordmark" aria-label="Tandem landing page">Tandem</Link>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {links.map(({ href, label, icon }) => (
          <Link key={href} href={href} className={`nav-item${pathname === href ? " active" : ""}`} aria-current={pathname === href ? "page" : undefined}>
            <Icon name={icon} /><span>{label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
