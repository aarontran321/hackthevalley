"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Baby,
  Check,
  Download,
  HeartHandshake,
  ScanLine,
  Trash2,
  UtensilsCrossed
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/icons";
import { useStoredValue } from "@/components/use-storage";
import { DEFAULT_PROFILE, storage } from "@/lib/storage";
import { activityTotals, mergeRecentFoods } from "@/lib/recent-foods";
import {
  estimatedDueDate,
  trimesterForWeek,
  weeksRemaining,
  type UserProfile
} from "@/types";

const conditions = ["Gestational diabetes", "High blood pressure", "Anaemia or low iron", "Other condition"];
const diets = ["Vegetarian", "Vegan", "Halal", "Kosher", "Dairy-free", "Gluten-free"];

const sourceLabels = { scanned: "Scanned", logged: "Logged" } as const;

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);
  // Snapshot of what is actually persisted, so we can flag unsaved edits.
  const [committed, setCommitted] = useState<UserProfile>(DEFAULT_PROFILE);

  const [analyses] = useStoredValue(storage.analyses);
  const [entries, refreshEntries] = useStoredValue(storage.entries);
  // Dates are formatted with the local timezone and locale, which the server
  // does not share. Render them only after mount to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = storage.profile();
    setProfile(stored);
    setCommitted(stored);
    setMounted(true);
  }, []);

  const dirty = JSON.stringify(profile) !== JSON.stringify(committed);

  const recent = useMemo(
    () => mergeRecentFoods(analyses ?? [], entries ?? [], 6),
    [analyses, entries]
  );
  const totals = useMemo(
    () => activityTotals(analyses ?? [], entries ?? []),
    [analyses, entries]
  );

  const toggle = (field: "healthConditions" | "dietaryPreferences", value: string) =>
    setProfile((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value]
    }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    storage.saveProfile(profile);
    setCommitted(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const forget = (name: string) => {
    if (!window.confirm(`Remove “${name}” from your recent foods and food log?`)) return;
    storage.forgetFood(name);
    refreshEntries();
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(storage.exportAll(), null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bumpsafe-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearActivity = () => {
    if (!window.confirm("Clear every scan, logged food and weekly summary? Your profile details stay.")) return;
    storage.clearActivity();
    refreshEntries();
  };

  const resetEverything = () => {
    if (!window.confirm("Reset everything, including your profile details? This cannot be undone.")) return;
    storage.clearEverything();
    setProfile(DEFAULT_PROFILE);
    setCommitted(DEFAULT_PROFILE);
    refreshEntries();
  };

  const week = profile.pregnancyWeek;
  const dueDate = estimatedDueDate(week);

  return (
    <AppShell>
      <main className="page container">
        <div style={{ maxWidth: 750, margin: "0 auto" }}>
          <div className="eyebrow">Your context</div>
          <h1 className="title" style={{ margin: "10px 0 12px" }}>Guidance that starts with you.</h1>
          <p className="subtitle" style={{ margin: "0 0 28px" }}>These details personalize educational guidance. They stay in this browser for the MVP and are not used to diagnose or assess your weight.</p>

          <section className="card card-pad" style={{ background: "linear-gradient(110deg,#e2ebdf,#f4e2dd)", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ width: 54, height: 54, display: "grid", placeItems: "center", background: "rgba(255,255,255,.6)", borderRadius: 18, fontFamily: "Georgia,serif", fontSize: 24 }}>
                  {profile.name.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <div>
                  <b style={{ fontFamily: "Georgia,serif", fontSize: 26 }}>{profile.name || "Your profile"}</b>
                  <div className="muted" style={{ fontSize: 14, marginTop: 3 }}>
                    Week {week} · Trimester {trimesterForWeek(week)} · {weeksRemaining(week)} weeks to go
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.5)", borderRadius: 14, padding: "10px 14px" }}>
                <Baby size={19} />
                <span style={{ fontSize: 14 }}>
                  <b>Estimated due date</b>
                  <br />
                  <small className="muted">{mounted ? dueDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "—"}</small>
                </span>
              </div>
            </div>
            <div className="grid-3" style={{ marginTop: 22, gap: 12 }}>
              {[
                ["Foods scanned", totals.scanned],
                ["Foods logged", totals.logged],
                ["Needed a closer look", totals.needsCare]
              ].map(([label, count]) => (
                <div key={label as string} style={{ background: "rgba(255,255,255,.55)", borderRadius: 14, padding: "12px 14px" }}>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{label as string}</div>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 28, marginTop: 2 }}>{count as number}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="card card-pad" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
              <div>
                <div className="eyebrow">Recent foods</div>
                <h2 style={{ margin: "7px 0 0" }}>What you have added lately</h2>
              </div>
              <Link href="/tracker" className="btn btn-outline" style={{ minHeight: 40, paddingInline: 15 }}>
                Full log <ArrowRight size={16} />
              </Link>
            </div>

            {!recent.length ? (
              <div className="notice" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <span>Nothing added yet. Scanned products and logged meals will collect here.</span>
                <Link href="/scan" className="btn btn-soft" style={{ minHeight: 40, paddingInline: 15 }}>
                  <ScanLine size={16} /> Scan a food
                </Link>
              </div>
            ) : (
              <div>
                {recent.map((food) => (
                  <div key={food.key} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center", padding: "15px 0", borderTop: "1px solid var(--line)" }}>
                    <div style={{ minWidth: 0 }}>
                      <b>{food.name}</b>
                      {food.isDemo && <span className="muted" style={{ fontSize: 11, marginLeft: 7 }}>demo</span>}
                      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                        {food.sources.map((source) => sourceLabels[source]).join(" · ")}
                        {food.mealType ? ` · ${food.mealType}` : ""}
                        {" · "}
                        {new Date(food.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <StatusBadge status={food.status} />
                    <div style={{ display: "flex", gap: 2 }}>
                      {food.analysisId && (
                        <Link href={`/analysis/${food.analysisId}`} aria-label={`View analysis for ${food.name}`} style={{ padding: 7, display: "grid", placeItems: "center" }}>
                          <ArrowRight size={16} />
                        </Link>
                      )}
                      <button onClick={() => forget(food.name)} aria-label={`Remove ${food.name}`} style={{ border: 0, background: "transparent", cursor: "pointer", padding: 7, color: "#8a5250" }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <form onSubmit={submit} className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
              <div>
                <div className="eyebrow">Personal information</div>
                <h2 style={{ margin: "7px 0 0" }}>Update your details</h2>
              </div>
              {dirty && <span className="muted" style={{ fontSize: 13 }}>Unsaved changes</span>}
            </div>

            <div className="grid-2">
              <label><span className="label">Display name</span><input className="input" required maxLength={60} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></label>
              <label><span className="label">Current pregnancy week</span><input className="input" type="number" min={1} max={42} required value={profile.pregnancyWeek} onChange={(e) => setProfile({ ...profile, pregnancyWeek: Number(e.target.value) })} /></label>
              <label><span className="label">Height (cm)</span><input className="input" type="number" min={100} max={230} required value={profile.heightCm} onChange={(e) => setProfile({ ...profile, heightCm: Number(e.target.value) })} /></label>
              <label><span className="label">Weight (kg)</span><input className="input" type="number" min={30} max={300} required value={profile.weightKg} onChange={(e) => setProfile({ ...profile, weightKg: Number(e.target.value) })} /></label>
            </div>
            <div style={{ background: "var(--sage)", borderRadius: 15, padding: 16, margin: "20px 0 26px", display: "flex", gap: 12 }}>
              <HeartHandshake size={21} /><span><b>Week {week} · Trimester {trimesterForWeek(week)}</b><br /><small>Calculated from your pregnancy week.{mounted ? ` Estimated due date ${dueDate.toLocaleDateString()}.` : ""}</small></span>
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: "0 0 25px" }}>
              <legend className="label">Health context <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                {conditions.map((item) => <button type="button" onClick={() => toggle("healthConditions", item)} className={`btn ${profile.healthConditions.includes(item) ? "btn-soft" : "btn-outline"}`} style={{ minHeight: 40, paddingInline: 14 }} key={item}>{profile.healthConditions.includes(item) && <Check size={15} />}{item}</button>)}
              </div>
            </fieldset>
            <fieldset style={{ border: 0, padding: 0, margin: "0 0 25px" }}>
              <legend className="label">Dietary preferences</legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                {diets.map((item) => <button type="button" onClick={() => toggle("dietaryPreferences", item)} className={`btn ${profile.dietaryPreferences.includes(item) ? "btn-soft" : "btn-outline"}`} style={{ minHeight: 40, paddingInline: 14 }} key={item}>{profile.dietaryPreferences.includes(item) && <Check size={15} />}{item}</button>)}
              </div>
            </fieldset>
            <div className="grid-2">
              <label><span className="label">Food allergies</span><input className="input" placeholder="e.g. peanuts, shellfish" value={profile.allergies} onChange={(e) => setProfile({ ...profile, allergies: e.target.value })} /></label>
              <label><span className="label">Foods or ingredients you avoid</span><input className="input" placeholder="e.g. mushrooms" value={profile.avoids} onChange={(e) => setProfile({ ...profile, avoids: e.target.value })} /></label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28 }}><button className="btn btn-primary" type="submit" disabled={!dirty && !saved}>{saved ? <><Check size={18} /> Saved</> : "Save profile"}</button></div>
          </form>

          <section className="card card-pad" style={{ marginTop: 20 }}>
            <div className="eyebrow">Your data</div>
            <h2 style={{ margin: "7px 0 9px" }}>Everything stays in this browser</h2>
            <p className="muted" style={{ margin: "0 0 20px", lineHeight: 1.6 }}>BumpSafe stores your profile and food history in this browser only, so clearing site data removes it. Export a copy before switching devices.</p>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-outline" onClick={exportData} style={{ minHeight: 42, paddingInline: 16 }}><Download size={16} /> Export my data</button>
              <button type="button" className="btn btn-outline" onClick={clearActivity} style={{ minHeight: 42, paddingInline: 16 }}><UtensilsCrossed size={16} /> Clear food history</button>
              <button type="button" className="btn btn-outline" onClick={resetEverything} style={{ minHeight: 42, paddingInline: 16, color: "#8a5250" }}><Trash2 size={16} /> Reset everything</button>
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
