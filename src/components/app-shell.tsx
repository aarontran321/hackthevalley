import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="shell"><Header />{children}<Disclaimer /></div>;
}
