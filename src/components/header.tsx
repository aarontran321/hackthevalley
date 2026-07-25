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
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="brand">
            <span className="brand-mark"><HeartPulse size={20} /></span>
            <span>nutri.ai<small>food guidance</small></span>
          </Link>
          <nav className="site-nav" aria-label="Primary navigation">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} title={label} className={pathname.startsWith(href) ? "is-active" : ""}>
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
