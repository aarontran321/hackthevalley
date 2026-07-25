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
  dueDateFor,
  parseISODate,
  trimesterForWeek,
  weekFor,
  weeksRemaining,
  type BabyCount,
  type DateBasis,
  type UnitSystem,
  type UserProfile
} from "@/types";

const conditions = ["Gestational diabetes", "High blood pressure", "Anaemia or low iron"];
const diets = ["Vegetarian", "Vegan", "Halal", "Kosher", "Dairy-free", "Gluten-free"];

type ChipField = "healthConditions" | "dietaryPreferences";
// Anything stored outside these lists is what the person typed under "Other".
const presets: Record<ChipField, string[]> = { healthConditions: conditions, dietaryPreferences: diets };

const sourceLabels = { scanned: "Scanned", logged: "Logged" } as const;

const basisOptions: Array<{ id: DateBasis; label: string }> = [
  { id: "due", label: "Due date" },
  { id: "lmp", label: "Last period" }
];
const babyOptions: Array<{ id: BabyCount; label: string }> = [
  { id: "one", label: "One" },
  { id: "twins", label: "Twins" },
  { id: "three_plus", label: "Three+" }
];
const unitOptions: Array<{ id: UnitSystem; label: string }> = [
  { id: "metric", label: "cm / kg" },
  { id: "imperial", label: "ft / lb" }
];

type TabId = "pregnancy" | "body" | "diet";
const tabs: Array<{ id: TabId; label: string }> = [
  { id: "pregnancy", label: "Pregnancy" },
  { id: "body", label: "Body" },
  { id: "diet", label: "Diet" }
];

// Heights and weights are always stored metric; units are a display choice.
const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;
const cmToFtIn = (cm: number) => {
  const total = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(total / 12), inches: total % 12 };
};

/** A weight in whichever unit is on show, stored back as kilograms. */
function WeightInput({ kg, units, onChange }: { kg: number | null; units: UnitSystem; onChange: (kg: number | null) => void }) {
  const imperial = units === "imperial";
  const display = kg === null ? "" : imperial ? Math.round(kg / KG_PER_LB) : Math.round(kg * 10) / 10;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <input
        className="input"
        type="number"
        min={imperial ? 66 : 30}
        max={imperial ? 660 : 300}
        value={display}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") return onChange(null);
          const value = Number(raw);
          onChange(imperial ? value * KG_PER_LB : value);
        }}
      />
      <span className="muted" style={{ fontSize: 14 }}>{imperial ? "lb" : "kg"}</span>
    </div>
  );
}

/** Explanatory line under a field label. */
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "5px 0 9px" }}>{children}</p>;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<TabId>("pregnancy");
  const [problem, setProblem] = useState<string | null>(null);
  const [otherOpen, setOtherOpen] = useState<Record<ChipField, boolean>>({ healthConditions: false, dietaryPreferences: false });
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

  const toggle = (field: ChipField, value: string) =>
    setProfile((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value]
    }));

  // What the person typed under "Other", or "" when they have not used it.
  const customFor = (field: ChipField) =>
    profile[field].find((item) => !presets[field].includes(item)) ?? "";

  // The typed text IS the stored value, so it reaches Gemini like any preset.
  const setCustom = (field: ChipField, text: string) =>
    setProfile((current) => {
      const kept = current[field].filter((item) => presets[field].includes(item));
      return { ...current, [field]: text.trim() ? [...kept, text] : kept };
    });

  const toggleOther = (field: ChipField) => {
    if (otherOpen[field] || customFor(field)) {
      setCustom(field, "");
      setOtherOpen((current) => ({ ...current, [field]: false }));
      return;
    }
    setOtherOpen((current) => ({ ...current, [field]: true }));
  };

  const otherChip = (field: ChipField, placeholder: string) => {
    const custom = customFor(field);
    const open = otherOpen[field] || Boolean(custom);
    return (
      <>
        <button type="button" onClick={() => toggleOther(field)} className={`btn ${open ? "btn-soft" : "btn-outline"}`} style={{ minHeight: 40, paddingInline: 14 }}>
          {open && <Check size={15} />}Other
        </button>
        {open && (
          <input
            className="input"
            /* Focus only when the chip was just clicked, never on page load. */
            autoFocus={otherOpen[field]}
            maxLength={60}
            placeholder={placeholder}
            value={custom}
            onChange={(event) => setCustom(field, event.target.value)}
            style={{ flex: "1 1 220px", minWidth: 190 }}
          />
        )}
      </>
    );
  };

  // Validated by hand rather than with `required`, because a native invalid
  // field on a hidden tab blocks submit without being focusable or visible.
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const fail = (target: TabId, message: string) => {
      setTab(target);
      setProblem(message);
    };
    if (!profile.name.trim()) return fail("pregnancy", "Add a display name.");
    if (!parseISODate(profile.dateValue)) return fail("pregnancy", "Pick a date so we can work out how far along you are.");
    if (!(profile.heightCm >= 100 && profile.heightCm <= 230)) return fail("body", "That height looks out of range.");
    if (!(profile.prePregnancyWeightKg >= 30 && profile.prePregnancyWeightKg <= 300)) return fail("body", "That pre-pregnancy weight looks out of range.");
    if (!(profile.age >= 12 && profile.age <= 60)) return fail("body", "That age looks out of range.");

    setProblem(null);
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

  // Derived live from the form state, so the header tracks edits before saving.
  const week = weekFor(profile);
  const dueDate = dueDateFor(profile);
  const dueLabel = mounted && dueDate
    ? dueDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "—";

  return (
    <AppShell>
      <main className="page container">
        <div style={{ maxWidth: 750, margin: "0 auto" }}>
          <div className="eyebrow">Your context</div>
          <h1 className="title" style={{ margin: "10px 0 12px" }}>Guidance that starts with you.</h1>
          <p className="subtitle" style={{ margin: "0 0 28px" }}>These details personalize educational guidance. They stay in this browser for the MVP and are not used to diagnose or assess your weight.</p>

          <section className="card card-pad" style={{ background: "#e7dfe0", marginBottom: 20 }}>
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
                  <small className="muted">{dueLabel}</small>
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

            <label style={{ display: "block", marginBottom: 22 }}>
              <span className="label">Display name</span>
              <input className="input" maxLength={60} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </label>

            <div role="tablist" aria-label="Profile sections" style={{ display: "flex", gap: 7, borderBottom: "1px solid var(--line)", marginBottom: 24 }}>
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => setTab(item.id)}
                  style={{
                    border: 0,
                    background: "transparent",
                    cursor: "pointer",
                    padding: "10px 16px",
                    fontSize: 15,
                    fontWeight: tab === item.id ? 700 : 500,
                    color: tab === item.id ? "var(--ink)" : "var(--muted)",
                    borderBottom: `2px solid ${tab === item.id ? "#8d6d71" : "transparent"}`,
                    marginBottom: -1
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {problem && (
              <div className="notice" style={{ marginBottom: 20, color: "#8a5250" }}>{problem}</div>
            )}

            {tab === "pregnancy" && (
              <div role="tabpanel">
                <fieldset style={{ border: 0, padding: 0, margin: "0 0 22px" }}>
                  <legend className="label">How would you like to tell me how far along you are?</legend>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 9 }}>
                    {basisOptions.map((option) => (
                      <button key={option.id} type="button" onClick={() => setProfile({ ...profile, dateBasis: option.id })} className={`btn ${profile.dateBasis === option.id ? "btn-soft" : "btn-outline"}`} style={{ minHeight: 40, paddingInline: 14 }}>
                        {profile.dateBasis === option.id && <Check size={15} />}{option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label style={{ display: "block", marginBottom: 22 }}>
                  <span className="label">{profile.dateBasis === "due" ? "Estimated due date" : "First day of your last period"}</span>
                  <Hint>
                    {profile.dateBasis === "due"
                      ? "From your dating scan if you’ve had one — that’s the more accurate figure."
                      : "Counting starts here: your due date is 40 weeks from this day."}
                  </Hint>
                  <input className="input" type="date" value={profile.dateValue} onChange={(e) => setProfile({ ...profile, dateValue: e.target.value })} />
                </label>

                <div style={{ background: "var(--sage)", borderRadius: 15, padding: 16, margin: "0 0 26px", display: "flex", gap: 12 }}>
                  <HeartHandshake size={21} />
                  <span>
                    <b>Week {week} · Trimester {trimesterForWeek(week)}</b>
                    <br />
                    <small>{dueDate ? `Estimated due date ${dueLabel} · ${weeksRemaining(week)} weeks to go.` : "Pick a date above and this fills in."}</small>
                  </span>
                </div>

                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="label">How many babies?</legend>
                  <Hint>This one tap changes almost every number that follows, so it’s worth getting right.</Hint>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                    {babyOptions.map((option) => (
                      <button key={option.id} type="button" onClick={() => setProfile({ ...profile, babies: option.id })} className={`btn ${profile.babies === option.id ? "btn-soft" : "btn-outline"}`} style={{ minHeight: 40, paddingInline: 14 }}>
                        {profile.babies === option.id && <Check size={15} />}{option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}

            {tab === "body" && (
              <div role="tabpanel">
                <fieldset style={{ border: 0, padding: 0, margin: "0 0 22px" }}>
                  <legend className="label">Units</legend>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 9 }}>
                    {unitOptions.map((option) => (
                      <button key={option.id} type="button" onClick={() => setProfile({ ...profile, units: option.id })} className={`btn ${profile.units === option.id ? "btn-soft" : "btn-outline"}`} style={{ minHeight: 40, paddingInline: 14 }}>
                        {profile.units === option.id && <Check size={15} />}{option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div style={{ marginBottom: 22 }}>
                  <span className="label">Height</span>
                  {profile.units === "metric" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 7 }}>
                      <input className="input" type="number" min={100} max={230} value={profile.heightCm} onChange={(e) => setProfile({ ...profile, heightCm: Number(e.target.value) })} />
                      <span className="muted" style={{ fontSize: 14 }}>cm</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 7 }}>
                      <input className="input" type="number" min={3} max={7} aria-label="Height, feet" value={cmToFtIn(profile.heightCm).ft} onChange={(e) => setProfile({ ...profile, heightCm: (Number(e.target.value) * 12 + cmToFtIn(profile.heightCm).inches) * CM_PER_IN })} />
                      <span className="muted" style={{ fontSize: 14 }}>ft</span>
                      <input className="input" type="number" min={0} max={11} aria-label="Height, inches" value={cmToFtIn(profile.heightCm).inches} onChange={(e) => setProfile({ ...profile, heightCm: (cmToFtIn(profile.heightCm).ft * 12 + Number(e.target.value)) * CM_PER_IN })} />
                      <span className="muted" style={{ fontSize: 14 }}>in</span>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 22 }}>
                  <span className="label">Pre-pregnancy weight</span>
                  <Hint>Your weight BEFORE this pregnancy — not what you weigh now. The recommended weight-gain range is keyed on this, so using today’s weight would shift the whole band.</Hint>
                  <WeightInput kg={profile.prePregnancyWeightKg} units={profile.units} onChange={(kg) => setProfile({ ...profile, prePregnancyWeightKg: kg ?? 0 })} />
                </div>

                <div style={{ marginBottom: 22 }}>
                  <span className="label">Current weight <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></span>
                  <Hint>Optional, and editable any time. Used to plot gain against the recommended range.</Hint>
                  <WeightInput kg={profile.currentWeightKg} units={profile.units} onChange={(kg) => setProfile({ ...profile, currentWeightKg: kg })} />
                </div>

                <div>
                  <span className="label">Age</span>
                  <Hint>Under 19 raises the calcium target — your own bones are still building.</Hint>
                  <input className="input" type="number" min={12} max={60} value={profile.age} onChange={(e) => setProfile({ ...profile, age: Number(e.target.value) })} />
                </div>
              </div>
            )}

            {tab === "diet" && (
              <div role="tabpanel">
                <fieldset style={{ border: 0, padding: 0, margin: "0 0 25px" }}>
                  <legend className="label">Health context <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></legend>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 9 }}>
                    {conditions.map((item) => <button type="button" onClick={() => toggle("healthConditions", item)} className={`btn ${profile.healthConditions.includes(item) ? "btn-soft" : "btn-outline"}`} style={{ minHeight: 40, paddingInline: 14 }} key={item}>{profile.healthConditions.includes(item) && <Check size={15} />}{item}</button>)}
                    {otherChip("healthConditions", "e.g. thyroid condition")}
                  </div>
                </fieldset>
                <fieldset style={{ border: 0, padding: 0, margin: "0 0 25px" }}>
                  <legend className="label">Dietary preferences <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></legend>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 9 }}>
                    {diets.map((item) => <button type="button" onClick={() => toggle("dietaryPreferences", item)} className={`btn ${profile.dietaryPreferences.includes(item) ? "btn-soft" : "btn-outline"}`} style={{ minHeight: 40, paddingInline: 14 }} key={item}>{profile.dietaryPreferences.includes(item) && <Check size={15} />}{item}</button>)}
                    {otherChip("dietaryPreferences", "e.g. pescatarian")}
                  </div>
                </fieldset>
                <div style={{ marginBottom: 22 }}>
                  <span className="label">Food allergies <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 9 }}>
                    <button type="button" onClick={() => setProfile({ ...profile, noAllergies: !profile.noAllergies, allergies: profile.noAllergies ? profile.allergies : "" })} className={`btn ${profile.noAllergies ? "btn-soft" : "btn-outline"}`} style={{ minHeight: 40, paddingInline: 14 }}>
                      {profile.noAllergies && <Check size={15} />}No food allergies
                    </button>
                    <input
                      className="input"
                      placeholder={profile.noAllergies ? "None" : "e.g. peanuts, shellfish"}
                      disabled={profile.noAllergies}
                      value={profile.allergies}
                      onChange={(e) => setProfile({ ...profile, allergies: e.target.value })}
                      style={{ flex: "1 1 220px", minWidth: 190, opacity: profile.noAllergies ? 0.55 : 1 }}
                    />
                  </div>
                </div>
                <label style={{ display: "block" }}>
                  <span className="label">Foods or ingredients you avoid <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></span>
                  <input className="input" placeholder="e.g. mushrooms" value={profile.avoids} onChange={(e) => setProfile({ ...profile, avoids: e.target.value })} />
                </label>
              </div>
            )}
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
