import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "nutri.ai — Pregnancy-aware food guidance",
  description: "Calm, personalized pregnancy food guidance grounded in trusted public-health sources."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
