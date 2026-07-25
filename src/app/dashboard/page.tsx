"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, ScanLine, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/icons";
import { storage } from "@/lib/storage";
import { trimesterForWeek } from "@/types";
import { useEffect, useState } from "react";
import type { ConsumptionEntry, FoodAnalysis, UserProfile } from "@/types";

export default function Dashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entries, setEntries] = useState<ConsumptionEntry[]>([]);
  const [recent, setRecent] = useState<FoodAnalysis[]>([]);
  useEffect(() => {
    setProfile(storage.profile());
    setEntries(storage.entries());
    setRecent(storage.analyses());
  }, []);
  if (!profile) return null;
  const counts = {
    suitable: entries.filter((e) => e.safetyStatus === "generally_suitable").length,
    caution: entries.filter((e) => e.safetyStatus === "use_caution").length,
    avoid: entries.filter((e) => e.safetyStatus === "consider_avoiding").length
  };
  return (
    <AppShell>
      <main className="page container cohesive-page dashboard-page">
        <section style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 20, flexWrap: "wrap", marginBottom: 28 }}>
          <div><div className="eyebrow">Saturday, July 25</div><h1 className="title" style={{ margin: "9px 0 8px" }}>Good morning, {profile.name}.</h1><p className="muted" style={{ margin: 0 }}>A calm look at your food week so far.</p></div>
          <Link href="/scan" className="btn btn-primary"><ScanLine size={18} /> Quick scan</Link>
        </section>
        <section className="card dashboard-profile" style={{ padding: 28, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div><div className="eyebrow">Your pregnancy</div><div style={{ display: "flex", gap: 12, alignItems: "baseline", marginTop: 8 }}><b style={{ fontFamily: "Georgia,serif", fontSize: 42 }}>Week {profile.pregnancyWeek}</b><span className="muted">· Trimester {trimesterForWeek(profile.pregnancyWeek)}</span></div></div>
          <Link href="/profile" className="btn btn-outline" style={{ background: "rgba(255,255,255,.45)" }}>Edit profile</Link>
        </section>
        <section className="grid-3" style={{ marginTop: 20 }}>
          {[
            ["Scans logged", entries.length, "var(--lavender)"],
            ["Generally suitable", counts.suitable, "#ddefe3"],
            ["Caution or avoid", counts.caution + counts.avoid, "#f8e9bf"]
          ].map(([label, count, color]) => <div className="card card-pad" key={label as string}><span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>{label as string}</span><div style={{ fontFamily: "Georgia,serif", fontSize: 37, marginTop: 8 }}>{count as number}</div><div style={{ height: 5, borderRadius: 5, background: color as string, marginTop: 12 }} /></div>)}
        </section>
        <section className="grid-2" style={{ marginTop: 20, alignItems: "stretch" }}>
          <div className="card card-pad">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div className="eyebrow">Recent scans</div><h2 style={{ margin: "7px 0 0" }}>What you checked</h2></div><Link href="/scan" aria-label="Scan food"><ArrowRight size={20} /></Link></div>
            <div style={{ marginTop: 18 }}>
              {recent.length ? recent.slice(0, 3).map((item) => <Link href={`/analysis/${item.id}`} key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 0", borderTop: "1px solid var(--line)" }}><span><b>{item.itemName}</b><br /><small className="muted">{new Date(item.createdAt).toLocaleDateString()}</small></span><StatusBadge status={item.status} /></Link>) : <div className="notice" style={{ marginTop: 20 }}>No live scans yet. Try a labeled demo example to see the complete analysis experience.</div>}
            </div>
          </div>
          <div className="card card-pad editorial-accent">
            <Sparkles size={22} color="#765e88" />
            <div className="eyebrow" style={{ marginTop: 20 }}>Weekly insight</div>
            <h2 style={{ margin: "8px 0" }}>{entries.length ? "Find the pattern behind your plate." : "Your week is ready for a head start."}</h2>
            <p className="muted" style={{ lineHeight: 1.6 }}>{entries.length ? "Gemini can look across your logged foods for recurring cautions and food-group representation—without diagnosing deficiencies." : "Load demo meals to preview a grounded, pregnancy-aware weekly pattern summary."}</p>
            <Link className="btn btn-primary" href="/tracker"><CalendarDays size={18} /> {entries.length ? "View your week" : "Try demo week"}</Link>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
