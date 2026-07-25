import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Inter_Tight } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Tare — pregnancy food scanner",
  description:
    "Scan a barcode or photograph food, get a trimester-aware verdict on whether it's safe, why, and what to eat instead.",
};

export const viewport: Viewport = {
  themeColor: "#FAF9F5",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${interTight.variable} ${plexMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b border-rule">
          <div className="mx-auto flex w-full max-w-[420px] items-baseline justify-between px-5 py-3">
            <span className="font-display text-base font-bold tracking-tight">
              TARE
            </span>
            <span className="font-mono text-xs text-graphite">
              pregnancy food scanner
            </span>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        {/* Persistent disclaimer — required in the app shell, every screen. */}
        <footer className="border-t border-rule">
          <p className="mx-auto w-full max-w-[420px] px-5 py-3 font-mono text-xs leading-relaxed text-graphite">
            Tare explains public food-safety guidance. It isn&rsquo;t medical
            advice &mdash; check with your provider.
          </p>
        </footer>
      </body>
    </html>
  );
}
