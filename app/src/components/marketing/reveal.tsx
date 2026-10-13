"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scroll-reveal — the site's single scroll motion system. Transform/opacity
 * only; the global reduced-motion rule collapses it to instant.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  /** Element to render (default div). Use as="li" when revealing list items
      so <li> stays a direct child of its <ol>/<ul> (axe list/listitem). */
  as?: "div" | "li";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  // SSR / no-JS safe: content renders VISIBLE until the client arms the
  // observer. Without this, SSR HTML ships opacity:0 inline and a JS failure,
  // disabled JS, or print-before-scroll leaves sections permanently blank.
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setArmed(true);
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "-40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={className ? `reveal ${className}` : "reveal"}
      style={
        armed && !shown
          ? {
              opacity: 0,
              transform: "translateY(14px)",
              transition: `opacity 500ms ease-out ${delay}ms, transform 500ms cubic-bezier(0.2,0.8,0.2,1) ${delay}ms`,
            }
          : armed
            ? {
                opacity: 1,
                transform: "none",
                transition: `opacity 500ms ease-out ${delay}ms, transform 500ms cubic-bezier(0.2,0.8,0.2,1) ${delay}ms`,
              }
            : undefined
      }
    >
      {children}
    </Tag>
  );
}
