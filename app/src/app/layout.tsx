import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Fraunces, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://medilink.example.com";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "MediLink — Proven patient history",
    template: "%s · MediLink",
  },
  description:
    "A longitudinal health record platform where every medical fact carries its source. Verified professionals contribute authenticated records; patients control access.",
  openGraph: {
    title: {
      default: "MediLink — Proven patient history",
      template: "%s · MediLink",
    },
    description:
      "A longitudinal health record platform where every medical fact carries its source. Verified professionals contribute authenticated records; patients control access.",
    url: appUrl,
    siteName: "MediLink",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a56c4",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // CSP nonce minted per-request by src/proxy.ts. Reading headers() opts
  // this layout (and every route under it) into dynamic rendering — required
  // for nonce-based CSP, since static prerenders have no request to mint
  // from. Absent on direct static-asset hits; the script simply renders
  // without a nonce then (same behaviour as before CSP existed).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Pre-hydration theme: reads localStorage/system before paint so
            dark mode never flashes. Must stay inline and blocking (it runs
            before any module loads, so it cannot import src/lib/theme —
            but its key MUST match THEME_STORAGE_KEY there; a rename updates
            both). Glass is unconditional: no transparency key is read. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=localStorage.getItem("medilink-theme")||"system";var d=c==="dark"||(c==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`,
          }}
        />
      </head>
      <body
        className={`${fraunces.variable} ${instrument.variable} ${plexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
