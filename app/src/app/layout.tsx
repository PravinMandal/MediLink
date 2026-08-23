import type { Metadata, Viewport } from "next";
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
  themeColor: "#14594b",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Pre-hydration theme: reads localStorage/system before paint so
            dark mode never flashes. Must stay inline and blocking. */}
        <script
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
