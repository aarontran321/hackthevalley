"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, HeartHandshake } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DEFAULT_PROFILE, storage } from "@/lib/storage";
import { trimesterForWeek, type UserProfile } from "@/types";

const conditions = ["Gestational diabetes", "High blood pressure", "Anaemia or low iron", "Other condition"];
const diets = ["Vegetarian", "Vegan", "Halal", "Kosher", "Dairy-free", "Gluten-free"];

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);
  useEffect(() => setProfile(storage.profile()), []);

  const toggle = (field: "healthConditions" | "dietaryPreferences", value: string) =>
    setProfile((current) => ({ ...current, [field]: current[field].includes(value) ? current[field].filter((item) => item !== value) : [...current[field], value] }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    storage.saveProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  return (
    <AppShell>
      <main className="page container">
        <div style={{ maxWidth: 750, margin: "0 auto" }}>
          <div className="eyebrow">Your context</div>
          <h1 className="title" style={{ margin: "10px 0 12px" }}>Guidance that starts with you.</h1>
          <p className="subtitle" style={{ margin: "0 0 28px" }}>These details personalize educational guidance. They stay in this browser for the MVP and are not used to diagnose or assess your weight.</p>
          <form onSubmit={submit} className="card card-pad">
            <div className="grid-2">
              <label><span className="label">Display name</span><input className="input" required maxLength={60} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></label>
              <label><span className="label">Current pregnancy week</span><input className="input" type="number" min={1} max={42} required value={profile.pregnancyWeek} onChange={(e) => setProfile({ ...profile, pregnancyWeek: Number(e.target.value) })} /></label>
              <label><span className="label">Height (cm)</span><input className="input" type="number" min={100} max={230} required value={profile.heightCm} onChange={(e) => setProfile({ ...profile, heightCm: Number(e.target.value) })} /></label>
              <label><span className="label">Weight (kg)</span><input className="input" type="number" min={30} max={300} required value={profile.weightKg} onChange={(e) => setProfile({ ...profile, weightKg: Number(e.target.value) })} /></label>
            </div>
            <div style={{ background: "var(--sage)", borderRadius: 15, padding: 16, margin: "20px 0 26px", display: "flex", gap: 12 }}>
              <HeartHandshake size={21} /><span><b>Week {profile.pregnancyWeek} · Trimester {trimesterForWeek(profile.pregnancyWeek)}</b><br /><small>This is calculated automatically from pregnancy week.</small></span>
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
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28 }}><button className="btn btn-primary" type="submit">{saved ? <><Check size={18} /> Saved</> : "Save profile"}</button></div>
          </form>
        </div>
      </main>
    </AppShell>
  );
}
