import Link from "next/link";
import { ArrowRight, Barcode, Camera, CheckCircle2, MonitorUp, ShieldCheck, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export default function Landing() {
  return (
    <AppShell>
      <main>
        <section className="container" style={{ minHeight: "calc(100vh - 142px)", display: "grid", gridTemplateColumns: "1.08fr .92fr", gap: 54, alignItems: "center", paddingBlock: 60 }}>
          <div className="fade-up">
            <div className="eyebrow" style={{ marginBottom: 20 }}><Sparkles size={14} style={{ display: "inline", marginRight: 7 }} />Pregnancy-aware food guidance</div>
            <h1 className="display" style={{ margin: 0, maxWidth: 720 }}>Know what’s on your plate, <i style={{ color: "#8d6d71", fontWeight: 400 }}>and why it matters.</i></h1>
            <p className="subtitle" style={{ maxWidth: 650, margin: "25px 0 30px" }}>Scan packaged foods, meals, and online products for calm, personalized guidance grounded in trusted public-health sources.</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link className="btn btn-primary" href="/scan">Scan a food <ArrowRight size={18} /></Link>
              <Link className="btn btn-outline" href="/profile">Set up your profile</Link>
            </div>
            <div style={{ display: "flex", gap: 23, flexWrap: "wrap", marginTop: 34, color: "var(--muted)", fontSize: 13 }}>
              <span><CheckCircle2 size={15} style={{ display: "inline", color: "#4d775d", marginRight: 6 }} />Source-grounded</span>
              <span><CheckCircle2 size={15} style={{ display: "inline", color: "#4d775d", marginRight: 6 }} />Personalized context</span>
              <span><CheckCircle2 size={15} style={{ display: "inline", color: "#4d775d", marginRight: 6 }} />Calm, clear language</span>
            </div>
          </div>
          <div className="card fade-up" style={{ padding: 22, position: "relative", overflow: "hidden", background: "linear-gradient(145deg,#f7e7df,#e3ecdf)" }}>
            <div style={{ background: "rgba(255,253,249,.92)", borderRadius: 20, padding: 24, margin: "34px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                <div><div className="eyebrow">Just analysed</div><h3 style={{ margin: "8px 0", fontSize: 23 }}>Imported soft cheese</h3></div>
                <span className="status status-caution">△ Use caution</span>
              </div>
              <p className="muted" style={{ lineHeight: 1.6 }}>Check the package for a pasteurization label before eating.</p>
              <div style={{ marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)" }}>WHAT AFFECTED THIS RESULT</div>
                <div style={{ display: "flex", gap: 11, marginTop: 12 }}><ShieldCheck size={20} color="#8a5e4f" /><span><b>Pasteurization unclear</b><br /><small className="muted">Relevant to Listeria precautions</small></span></div>
              </div>
            </div>
          </div>
        </section>
        <section style={{ background: "#f1eee7", padding: "75px 0" }}>
          <div className="container">
            <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 35px" }}><div className="eyebrow">One place, every format</div><h2 className="title" style={{ margin: "12px 0" }}>From kitchen counter to checkout screen.</h2></div>
            <div className="grid-3">
              {[
                [Barcode, "Scan a barcode", "Pull ingredients and nutrition details from packaged products."],
                [Camera, "Understand a meal", "Gemini vision identifies likely foods, preparation, and uncertainty."],
                [MonitorUp, "Check a screenshot", "Analyse multiple products visible in shopping or menu screenshots."]
              ].map(([Icon, title, text]) => {
                const C = Icon as typeof Barcode;
                return <div className="card card-pad" key={title as string}><span style={{ width: 46, height: 46, display: "grid", placeItems: "center", background: "var(--lavender)", borderRadius: 15 }}><C size={22} /></span><h3 style={{ margin: "20px 0 8px" }}>{title as string}</h3><p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{text as string}</p></div>;
              })}
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
