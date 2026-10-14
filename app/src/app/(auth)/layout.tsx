import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoMark } from "@/components/logo-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Ambient glows — same language as marketing, calmer */}
      <div aria-hidden className="glow-field">
        <div className="glow-blob glow-blob-blue left-[-12%] top-[-18%] h-[30rem] w-[30rem]" />
        <div className="glow-blob glow-blob-deep bottom-[-24%] right-[-10%] h-[34rem] w-[34rem]" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="MediLink home">
          <LogoMark size={30} aria-hidden />
          <span className="font-display text-[18px] font-bold tracking-tight text-ink">
            MediLink
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-14 pt-2 sm:px-6">
        {children}
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-5xl px-5 pb-6 text-center sm:px-8">
        <p className="text-[11.5px] text-ink-faint">
          Protected by scoped consent &amp; audited access · Demo uses synthetic data only
        </p>
      </footer>
    </div>
  );
}
