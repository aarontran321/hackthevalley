"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, CalendarDays, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/icons";
import { WeekChat } from "@/components/week-chat";
import { WeekJudgement } from "@/components/week-judgement";
import { storage } from "@/lib/storage";
import type { ConsumptionEntry, WeeklySummary } from "@/types";

export default function TrackerPage() {
  const [entries, setEntries] = useState<ConsumptionEntry[]>([]);
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [meal, setMeal] = useState("all");
  useEffect(() => {
    setEntries(storage.entries());
    setSummary(storage.summary());
  }, []);
  const save = (next: ConsumptionEntry[]) => { setEntries(next); storage.saveEntries(next); };
  const filtered = meal === "all" ? entries : entries.filter((item) => item.mealType === meal);
  const byDay = useMemo(() => filtered.reduce<Record<string, ConsumptionEntry[]>>((acc, item) => {
    const key = new Date(item.timestamp).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    (acc[key] ||= []).push(item); return acc;
  }, {}), [filtered]);
  const chartData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days.map((day, index) => ({ day, foods: entries.filter((item) => new Date(item.timestamp).getDay() === index).length }));
  }, [entries]);
  const edit = (entry: ConsumptionEntry) => {
    const quantity = window.prompt("Update quantity", entry.quantity || "");
    if (quantity === null) return;
    save(entries.map((item) => item.id === entry.id ? { ...item, quantity } : item));
  };
  const remove = (id: string) => save(entries.filter((item) => item.id !== id));
  const seed = () => { storage.seedEntries(); setEntries(storage.entries()); };

  return (
    <AppShell>
      <main className="page container">
        <section style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "end", flexWrap: "wrap", marginBottom: 25 }}>
          <div><div className="eyebrow">Consumption tracker</div><h1 className="title" style={{ margin: "9px 0 8px" }}>Your week, without judgment.</h1><p className="muted" style={{ margin: 0 }}>Notice patterns in what you’ve logged—not a scorecard of how you eat.</p></div>
          <div style={{ display: "flex", gap: 9 }}><Link href="/scan" className="btn btn-outline"><Plus size={18} /> Add food</Link>{entries.length > 0 && <Link href="/weekly-summary" className="btn btn-primary"><Sparkles size={18} /> Weekly summary</Link>}</div>
        </section>
        {!entries.length ? <section className="card card-pad" style={{ textAlign: "center", paddingBlock: 60 }}><CalendarDays size={38} color="#66736d" /><h2>Your week is a blank canvas.</h2><p className="muted">Add analysed foods as you go, or load a sample week for the full demo.</p><div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}><button className="btn btn-soft" onClick={seed}><Sparkles size={18} /> Load demo week</button><Link href="/scan" className="btn btn-primary">Scan your first food</Link></div><small className="muted" style={{ display: "block", marginTop: 13 }}>Demo entries are sample data stored only in this browser.</small></section> : <>
          <section className="grid-3">
            <div className="card card-pad"><span className="muted">Foods logged</span><div style={{ fontFamily: "Georgia,serif", fontSize: 38, marginTop: 8 }}>{entries.length}</div></div>
            <div className="card card-pad"><span className="muted">Generally suitable</span><div style={{ fontFamily: "Georgia,serif", fontSize: 38, marginTop: 8 }}>{entries.filter((e) => e.safetyStatus === "generally_suitable").length}</div></div>
            <div className="card card-pad"><span className="muted">Needs a closer look</span><div style={{ fontFamily: "Georgia,serif", fontSize: 38, marginTop: 8 }}>{entries.filter((e) => e.safetyStatus !== "generally_suitable").length}</div></div>
          </section>
          <section className="grid-2" style={{ marginTop: 20, gridTemplateColumns: ".8fr 1.2fr" }}>
            <div className="card card-pad">
              <div className="eyebrow"><BarChart3 size={14} style={{ display: "inline", marginRight: 6 }} />Week at a glance</div>
              <div style={{ height: 230, marginTop: 20 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ebe5dc" /><XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} /><YAxis hide allowDecimals={false} /><Tooltip cursor={{ fill: "#f4f0e8" }} /><Bar dataKey="foods" fill="#789582" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
            </div>
            <div className="card card-pad" style={{ background: "var(--lavender)" }}><div className="eyebrow">Nutrient-pattern preview</div><h2 style={{ margin: "9px 0" }}>What’s showing up in your log</h2><p className="muted" style={{ lineHeight: 1.6 }}>Your available entries include {entries.filter(e => (e.estimatedNutrients?.protein || 0) > 10).length} identifiable protein-rich choices and {entries.filter(e => (e.estimatedNutrients?.calcium || 0) > 100).length} calcium-containing choices. These are estimates from logged items only.</p><Link href="/weekly-summary" className="btn btn-primary"><Sparkles size={18} /> Generate full pattern analysis</Link></div>
          </section>
          <WeekJudgement entries={entries} summary={summary} onSummary={setSummary} />
          <WeekChat entries={entries} summary={summary} />
          <section className="card card-pad" style={{ marginTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}><h2 style={{ margin: 0 }}>Daily food log</h2><select className="input" style={{ width: 150 }} value={meal} onChange={(e) => setMeal(e.target.value)}><option value="all">All meals</option><option>breakfast</option><option>lunch</option><option>dinner</option><option>snack</option></select></div>
            {Object.entries(byDay).map(([day, items]) => <div key={day} style={{ marginTop: 25 }}><div className="eyebrow">{day}</div>{items.map((entry) => <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 14, alignItems: "center", padding: "17px 0", borderBottom: "1px solid var(--line)" }}><div><b>{entry.itemName}</b><div className="muted" style={{ fontSize: 13, marginTop: 4, textTransform: "capitalize" }}>{entry.mealType} · {entry.quantity || "Quantity not set"}</div></div><StatusBadge status={entry.safetyStatus} /><div style={{ display: "flex", gap: 4 }}><button onClick={() => edit(entry)} aria-label={`Edit ${entry.itemName}`} style={{ border: 0, background: "transparent", cursor: "pointer", padding: 7 }}><Pencil size={16} /></button><button onClick={() => remove(entry.id)} aria-label={`Delete ${entry.itemName}`} style={{ border: 0, background: "transparent", cursor: "pointer", padding: 7, color: "#8a5250" }}><Trash2 size={16} /></button></div></div>)}</div>)}
          </section>
        </>}
      </main>
    </AppShell>
  );
}
