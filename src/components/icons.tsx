import { AlertTriangle, CheckCircle2, HelpCircle, ShieldAlert } from "lucide-react";
import type { SafetyStatus } from "@/types";

export const statusMeta: Record<SafetyStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  generally_suitable: { label: "Generally suitable", className: "status-suitable", icon: CheckCircle2 },
  use_caution: { label: "Use caution", className: "status-caution", icon: AlertTriangle },
  consider_avoiding: { label: "Consider avoiding", className: "status-avoid", icon: ShieldAlert },
  insufficient_information: { label: "Not enough information", className: "status-insufficient", icon: HelpCircle }
};

export function StatusBadge({ status }: { status: SafetyStatus }) {
  const meta = statusMeta[status];
  const Icon = meta.icon;
  return <span className={`status ${meta.className}`}><Icon size={15} aria-hidden />{meta.label}</span>;
}
