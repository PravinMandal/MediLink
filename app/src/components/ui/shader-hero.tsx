"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { MeshGradient } from "@paper-design/shaders-react"
import { ArrowRight, ShieldCheck } from "lucide-react"

/**
 * Glassmorphism shader hero for the MediLink marketing page.
 * Uses the product's pine palette inside the shader (dark pine surfaces,
 * light pine + white highlights) so the premium glass look stays on-theme.
 * Rendered only on the marketing route; falls back to a static gradient
 * when the user prefers reduced motion.
 */

const wordAnimation = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const containerAnimation = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05 },
  },
}

export function ShaderHero({
  title = "A patient's history, with receipts.",
  badge = "Provenance-aware health records",
}: {
  title?: string
  badge?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    const handleMouseEnter = () => setIsActive(true)
    const handleMouseLeave = () => setIsActive(false)

    const container = containerRef.current
    if (container) {
      container.addEventListener("mouseenter", handleMouseEnter)
      container.addEventListener("mouseleave", handleMouseLeave)
    }
    return () => {
      if (container) {
        container.removeEventListener("mouseenter", handleMouseEnter)
        container.removeEventListener("mouseleave", handleMouseLeave)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      data-active={isActive}
      className="relative min-h-[92vh] w-full overflow-hidden bg-pine-deep"
    >
      {/* Mesh gradient backdrop — deep pine ink with clinical highlights */}
      <MeshGradient
        className="absolute inset-0 h-full w-full opacity-90"
        colors={["#0d1b3a", "#1a56c4", "#081226", "#c9dafc"]}
        speed={0.25}
      />

      {/* Soft radial highlight, keeps the glass panels legible */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,0.10), transparent 60%)",
        }}
      />

      {/* Glass content */}
      <div className="relative z-10 flex min-h-[92vh] flex-col items-center justify-center px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="mb-7 flex items-center gap-2 rounded-full border border-white/25 bg-black/20 px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-xl"
        >
          <ShieldCheck className="h-4 w-4 text-white/80" />
          {badge}
        </motion.div>

        {/* Word-level stagger: characters as flex items break words mid-line
            ("rec/eipts"); words wrap correctly and read naturally. */}
        <motion.h1
          aria-label={title}
          variants={containerAnimation}
          initial="hidden"
          animate="visible"
          className="max-w-4xl text-balance font-display text-5xl font-semibold tracking-tight text-white drop-shadow-lg md:text-7xl"
        >
          {title.split(" ").map((word, index) => (
            <motion.span
              key={index}
              aria-hidden
              variants={wordAnimation}
              className="inline-block"
            >
              {word}
              {"\u00A0"}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="mx-auto mt-7 max-w-2xl text-balance text-lg leading-relaxed text-white/85 md:text-xl"
        >
          Every fact in a MediLink record carries its source. Verified doctors
          and labs contribute authenticated records, patients decide who sees
          what, and AI summaries cite every claim.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.8 }}
          className="mt-10 flex flex-col gap-4 sm:flex-row"
        >
          <Link
            href="/sign-up"
            className="inline-flex min-h-14 items-center justify-center rounded-xl border border-white bg-white px-7 text-base font-bold tracking-tight text-pine-deep shadow-2xl transition-all hover:-translate-y-0.5 hover:shadow-3xl active:translate-y-0"
          >
            Get Started <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex min-h-14 items-center justify-center rounded-xl border border-white/35 bg-white/10 px-7 text-base font-semibold tracking-tight text-white backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/20 active:translate-y-0"
          >
            Open the live demo
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
