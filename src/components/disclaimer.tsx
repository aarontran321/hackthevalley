import { Info } from "lucide-react";

export function Disclaimer() {
  return (
    <div className="disclaimer-bar">
      <div className="container disclaimer-inner">
        <Info size={16} style={{ flex: "0 0 auto", marginTop: 1 }} />
        <span><b>nutri.ai provides educational information and is not medical advice.</b> Food safety and nutritional needs vary by person and pregnancy. Confirm important decisions with a qualified healthcare professional.</span>
      </div>
    </div>
  );
}
