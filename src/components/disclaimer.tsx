import { Info } from "lucide-react";

export function Disclaimer() {
  return (
    <div className="disclaimer-bar" style={{ borderTop: "1px solid var(--line)", background: "#f2eee6", padding: "15px 0" }}>
      <div className="container" style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "#5d6762", fontSize: 12.5, lineHeight: 1.45 }}>
        <Info size={16} style={{ flex: "0 0 auto", marginTop: 1 }} />
        <span><b>BumpSafe provides educational information and is not medical advice.</b> Food safety and nutritional needs vary by person and pregnancy. Confirm important decisions with a qualified healthcare professional.</span>
      </div>
    </div>
  );
}
