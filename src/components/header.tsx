"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartPulse, LayoutDashboard, ScanLine, Soup, UserRound } from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/tracker", label: "Tracker", icon: Soup },
  { href: "/profile", label: "Profile", icon: UserRound }
];

export function Header() {
  const pathname = usePathname();
  return (
    <>
      <header style={{ height: 72, borderBottom: "1px solid var(--line)", background: "rgba(251,248,242,.88)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 40 }}>
        <div className="container" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700 }}>
            <span style={{ width: 36, height: 36, display: "grid", placeItems: "center", background: "var(--sage)", borderRadius: 12 }}><HeartPulse size={20} /></span>
            BumpSafe
          </Link>
          <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {nav.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} title={label} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 12px", borderRadius: 999, fontSize: 14, fontWeight: 700, background: pathname.startsWith(href) ? "var(--sage)" : "transparent" }}>
                <Icon size={17} /><span className="nav-label">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <style jsx global>{`@media(max-width:620px){.nav-label{display:none}}`}</style>
    </>
  );
}
