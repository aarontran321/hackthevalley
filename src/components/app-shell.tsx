import { AskPanel } from "@/components/ask-panel";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Header />
      {children}
      <Disclaimer />
      {/* Reachable from every page, including a first visit with nothing scanned. */}
      <AskPanel />
    </div>
  );
}
