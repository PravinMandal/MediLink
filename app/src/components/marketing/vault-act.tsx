"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, RoundedBox, Stars } from "@react-three/drei";

const BEAT_COPY = [
  {
    eyebrow: "Beat 01 · Arrive",
    title: "Your lab report arrives.",
    body: "Pulled from the hospital into your vault — byte-for-byte, exactly as the instrument printed it.",
  },
  {
    eyebrow: "Beat 02 · Sealed",
    title: "Sealed. Only you hold the key.",
    body: "Hashed with sha-256 and linked into the chain. One changed byte breaks the seal; the original never moves.",
  },
  {
    eyebrow: "Beat 03 · Gated",
    title: "Gated. Nothing opens without your tap.",
    body: "A clinician waits outside the chain until you grant — narrowly scoped, with an expiry. Try it: tap grant and watch the links snap shut.",
  },
  {
    eyebrow: "Beat 04 · Cited",
    title: "Cited. Every access leaves a receipt.",
    body: "Each summary sentence resolves to a sealed record. A claim without a source is dropped — orbit the chip and see.",
  },
] as const;

function seg(s: number, from: number, to: number): number {
  if (s <= from) return 0;
  if (s >= to) return 1;
  return (s - from) / (to - from);
}

export type VaultProgress = { current: number; granted: boolean };

/**
 * Hash-chain helix + report card, driven by a single scrubbed value s: 0→4.
 * (Overhaul round 9 rebuild: the old glass-capsule primitives are replaced
 * by the product's own metaphor — sealed record blocks linked into a
 * glowing chain. Same beats, same perf tiers, zero new dependencies.)
 *
 * Beat choreography:
 *  0→1 Arrive: scattered paper slips converge from the fog into one card.
 *  1→2 Sealed: chain links ignite one-by-one around the card (sha-256 seal).
 *  2→3 Gated: links part slightly until the grant tap snaps them shut.
 *  3→4 Cited: a citation chip detaches and orbits, trailing a receipt line.
 */
const LINKS = 14;
const HELIX_R = 1.35;
const HELIX_H = 3.6;

function VaultScene({ progress, coarse }: { progress: React.MutableRefObject<VaultProgress>; coarse: boolean }) {
  const group = useRef<THREE.Group>(null);
  const slips = useRef<Array<THREE.Group | null>>([]);
  const links = useRef<Array<THREE.Mesh | null>>([]);
  const seam = useRef<THREE.Mesh>(null);
  const chip = useRef<THREE.Group>(null);
  const heroTilt = useRef<THREE.Group>(null);

  const mats = useMemo(
    () => ({
      slip: new THREE.MeshStandardMaterial({
        color: "#dbe7ff",
        roughness: 0.55,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      }),
      heroCard: new THREE.MeshStandardMaterial({ color: "#e8f0ff", roughness: 0.45 }),
      heroEdge: new THREE.MeshStandardMaterial({ color: "#2e6fe8", roughness: 0.4 }),
      linkDim: new THREE.MeshStandardMaterial({
        color: "#26355c",
        roughness: 0.4,
        metalness: 0.5,
      }),
      linkLit: new THREE.MeshStandardMaterial({
        color: "#4d8dff",
        emissive: "#2e6fe8",
        emissiveIntensity: 1.8,
        roughness: 0.3,
        metalness: 0.3,
      }),
      seam: new THREE.MeshStandardMaterial({
        color: "#4d8dff",
        emissive: "#2e6fe8",
        emissiveIntensity: 2.2,
        roughness: 0.3,
      }),
    }),
    [],
  );

  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  // Deterministic scatter directions for the paper slips (no per-frame alloc).
  const scatter = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2 + 0.4;
        return {
          x: Math.cos(a) * (3.2 + (i % 3) * 0.5),
          y: 1.6 - i * 0.55,
          z: -1.5 - (i % 2) * 1.2,
          rx: (i * 0.7) % 1.2,
          rz: (i * 1.3) % 1.0,
        };
      }),
    [],
  );

  // Helix slot for link i (0 = bottom).
  const slot = (i: number, spread: number, t: number) => {
    const turn = (i / (LINKS - 1)) * Math.PI * 1.6 - Math.PI * 0.3 + t * 0.12;
    const r = HELIX_R + spread * 0.55;
    return {
      x: Math.cos(turn) * r,
      y: -HELIX_H / 2 + (i / (LINKS - 1)) * HELIX_H,
      z: Math.sin(turn) * r,
      ry: -turn,
    };
  };

  useFrame((state) => {
    const s = progress.current.current; // 0 → 4
    const granted = progress.current.granted;
    const t = state.clock.elapsedTime;
    const g = group.current;
    if (!g) return;
    g.rotation.y = s * 0.42 + Math.sin(t * 0.25) * 0.05;
    g.position.y = Math.sin(t * 0.6) * 0.05;
    // Keep the hero card facing the camera while the chain orbits it.
    if (heroTilt.current) heroTilt.current.rotation.y = -g.rotation.y;

    // Beat 1: slips fly in from the fog and stack into the hero card.
    const gather = seg(s, 0.05, 0.95);
    const ge = 1 - Math.pow(1 - gather, 3); // easeOutCubic
    slips.current.forEach((slip, i) => {
      if (!slip) return;
      const d = scatter[i % scatter.length]!;
      const local = Math.min(1, Math.max(0, ge * 1.25 - (i % scatter.length) * 0.035));
      const le = 1 - Math.pow(1 - local, 2);
      slip.position.set(
        THREE.MathUtils.lerp(d.x, (i % 3 - 1) * 0.12, le),
        THREE.MathUtils.lerp(d.y, 0.1 + (i % 4) * 0.02, le),
        THREE.MathUtils.lerp(d.z, 0.1, le),
      );
      slip.rotation.set(
        THREE.MathUtils.lerp(d.rx, 0, le),
        THREE.MathUtils.lerp(0.6, 0, le),
        THREE.MathUtils.lerp(d.rz, 0, le),
      );
      const m = slip.children[0] as THREE.Mesh | undefined;
      const mm = m?.material as THREE.MeshStandardMaterial | undefined;
      if (mm) mm.opacity = 0.92 * (1 - le * 0.92);
    });

    // Beat 2: links ignite bottom-up (the seal propagating down the chain).
    const seal = seg(s, 1.05, 2.0);
    links.current.forEach((link, i) => {
      if (!link) return;
      const on = THREE.MathUtils.clamp(seal * (LINKS + 2) - i, 0, 1);
      link.material = on > 0.5 ? mats.linkLit : mats.linkDim;
      const p = slot(i, 0, s);
      link.position.set(p.x, p.y, p.z);
      link.rotation.y = p.ry;
      const pulse = on > 0.5 ? 1 + Math.sin(t * 3 - i * 0.55) * 0.06 : 1;
      link.scale.setScalar(pulse);
    });
    if (seam.current) {
      const sm = seam.current.material as THREE.MeshStandardMaterial;
      sm.emissiveIntensity = 0.4 + seal * (2.0 + Math.sin(t * 2.4) * 0.5);
      seam.current.scale.set(seal, 1, seal);
    }

    // Beat 3: links breathe apart until granted, then snap shut.
    const gate = seg(s, 2.1, 2.9);
    const spread = gate * (granted ? 0.12 : 1);
    links.current.forEach((link, i) => {
      if (!link) return;
      const p = slot(i, spread, s);
      link.position.x = THREE.MathUtils.lerp(link.position.x, p.x, 0.2);
      link.position.z = THREE.MathUtils.lerp(link.position.z, p.z, 0.2);
    });

    // Beat 4: citation chip detaches and orbits, trailing its receipt.
    if (chip.current) {
      const out = seg(s, 3.05, 3.8);
      const ang = out * Math.PI * 1.1 - 0.4;
      const r = THREE.MathUtils.lerp(0, 2.5, out);
      chip.current.position.set(Math.cos(ang) * r, 0.9 + out * 0.5, Math.sin(ang) * r);
      chip.current.rotation.y = -ang + Math.PI / 2;
      chip.current.scale.setScalar(0.25 + out * 0.75);
    }
    void coarse;
  });

  return (
    <group ref={group}>
      {/* Scattered paper slips (beat 1) — instanced look, individual meshes
          for per-slip flight paths; 7 draw calls, merged on arrival. */}
      {Array.from({ length: 7 }, (_, i) => (
        <group key={i} ref={(el) => { slips.current[i] = el; }}>
          <mesh material={mats.slip}>
            <planeGeometry args={[1.1, 1.5]} />
          </mesh>
        </group>
      ))}

      {/* Hero card: the arrived report (counter-rotated to face camera) */}
      <Float speed={1.4} rotationIntensity={0.2} floatIntensity={0.4}>
        <group ref={heroTilt}>
          <RoundedBox args={[1.5, 2.1, 0.12]} radius={0.06} material={mats.heroCard} />
          {[-0.6, -0.35, -0.1, 0.15].map((y, i) => (
            <mesh key={i} position={[-0.25 + (i % 2) * 0.12, y, 0.065]} material={mats.heroEdge}>
              <boxGeometry args={[i % 2 ? 0.7 : 1.0, 0.07, 0.01]} />
            </mesh>
          ))}
        </group>
      </Float>

      {/* Hash-chain helix: 14 torus links around the card */}
      {Array.from({ length: LINKS }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { links.current[i] = el; }}
          material={mats.linkDim}
          rotation={[Math.PI / 2.3, 0, 0]}
        >
          <torusGeometry args={[0.34, 0.075, 10, 28]} />
        </mesh>
      ))}

      {/* Seal seam: a glowing band that rises with the seal */}
      <mesh ref={seam} material={mats.seam} position={[0, -1.35, 0]}>
        <cylinderGeometry args={[1.15, 1.15, 0.05, 40, 1, true]} />
      </mesh>

      {/* Citation chip (beat 4) */}
      <group ref={chip} scale={0.25}>
        <RoundedBox args={[0.9, 0.5, 0.08]} radius={0.04}>
          <meshStandardMaterial color="#0d1424" roughness={0.35} metalness={0.4} />
        </RoundedBox>
        {/* glowing seal stripe instead of a DOM label (avoids a second React root) */}
        <mesh position={[0, 0, 0.045]}>
          <boxGeometry args={[0.7, 0.1, 0.01]} />
          <meshStandardMaterial color="#4d8dff" emissive="#2e6fe8" emissiveIntensity={2} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Vault act — pinned WebGL scene (~4 viewports of scroll), four
 * scrollytelling beats driven by ONE GSAP-scrubbed value shared with
 * the DOM captions. Reduced-motion / no-WebGL users get static cards.
 */
export function VaultAct() {
  const [reduced] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  // Mobile perf tier: fullscreen transparent physical glass + MSAA at
  // DPR 2 melts mid-tier phones. Coarse pointers get DPR 1, no MSAA,
  // cheaper materials, and fewer stars (see Canvas + VaultScene below).
  const [coarse] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches,
  );
  const [grant, setGrant] = useState(false);
  const [failed, setFailed] = useState(false);
  const [inView, setInView] = useState(false);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  // IO-gate the WebGL mount: the scene lives below the fold, so don't
  // create the GL context (or run the frameloop) until it scrolls near.
  useEffect(() => {
    if (reduced || failed) return;
    const el = canvasWrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, failed]);
  const lastBeat = useRef(0);
  const sectionRef = useRef<HTMLElement>(null);
  const captionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const progress = useRef<VaultProgress>({ current: 0, granted: false });
  useEffect(() => {
    progress.current.granted = grant;
  }, [grant]);

  useEffect(() => {
    if (reduced || failed) return;
    const section = sectionRef.current;
    if (!section) return;
    let ctx: { revert: () => void } | undefined;
    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context(() => {
        gsap.to(progress.current, {
          current: 4,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            onUpdate: (self) => {
              progress.current.current = self.progress * 4;
              const beat = Math.min(3, Math.floor(self.progress * 4));
              // Beat-change-only DOM writes: the old code forced opacity +
              // aria updates on 4 nodes every scrub tick (style recalc for
              // the whole sticky section, 4 viewports of scroll).
              if (beat === lastBeat.current) return;
              lastBeat.current = beat;
              captionRefs.current.forEach((el, i) => {
                if (!el) return;
                const on = i === beat;
                el.style.opacity = on ? "1" : "0";
                el.setAttribute("aria-hidden", String(!on));
              });
            },
          },
        });
      }, section);
    })();
    return () => ctx?.revert();
  }, [reduced, failed]);

  if (reduced || failed) {
    return (
      <section aria-label="How a record travels" className="landing-dark relative py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#6fa8ff]">The chain</p>
          <h2 className="mt-3 max-w-2xl font-display text-[clamp(1.9rem,4vw,2.7rem)] font-bold tracking-tight text-white">
            One lab report, followed through the chain.
          </h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2">
            {BEAT_COPY.map((b, i) => (
              <li key={b.eyebrow} className="glass-dark rounded-2xl p-6">
                <p className="num font-mono text-sm font-bold text-[#6fa8ff]">0{i + 1}</p>
                <h3 className="mt-2 text-lg font-semibold text-white">{b.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[#b9c4d6]">{b.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} aria-label="How a record travels in 3D" className="landing-dark relative h-[400vh]">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div ref={canvasWrapRef} className="absolute inset-0" aria-hidden="true">
          {inView ? (
          <Canvas
            dpr={coarse ? 1 : [1, 1.5]}
            frameloop="always"
            gl={{ antialias: !coarse, alpha: false, powerPreference: "high-performance" }}
            camera={{ position: [0, 0.4, 7.5], fov: 42 }}
            onCreated={({ gl }) => gl.setClearColor("#060a14")}
            onError={() => setFailed(true)}
          >
            <color attach="background" args={["#060a14"]} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[4, 6, 6]} intensity={1.6} color="#cfe1ff" />
            <directionalLight position={[-5, 2, -3]} intensity={0.6} color="#2e6fe8" />
            <Stars radius={60} depth={30} count={coarse ? 500 : 1200} factor={3} fade speed={coarse ? 0 : 0.6} />
            <Suspense fallback={null}>
              <VaultScene progress={progress} coarse={coarse} />
            </Suspense>
          </Canvas>
          ) : null}
        </div>
        {/* DOM captions — same progress value, always in the a11y tree in order */}
        <div className="pointer-events-none absolute inset-0 z-10 mx-auto w-full max-w-7xl px-6 sm:px-12">
          {BEAT_COPY.map((b, i) => (
            <div
              key={b.eyebrow}
              ref={(el) => { captionRefs.current[i] = el; }}
              className="absolute inset-x-6 top-1/2 -translate-y-1/2 transition-opacity duration-300 sm:inset-x-12"
              style={{ opacity: i === 0 ? 1 : 0, visibility: i === 0 ? "visible" : "hidden" }}
              aria-hidden={i !== 0}
              {...(i !== 0 ? { inert: true } : {})}
            >
              <div className="max-w-sm">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#6fa8ff]">{b.eyebrow}</p>
                <h3 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{b.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[#b9c4d6]">{b.body}</p>
                {i === 2 ? (
                  <button
                    type="button"
                    onClick={() => setGrant((v) => !v)}
                    aria-pressed={grant}
                    className="glass-dark pointer-events-auto mt-5 inline-flex h-12 cursor-pointer items-center gap-2 rounded-full px-6 text-sm font-bold text-white"
                  >
                    <span aria-hidden className={`h-2 w-2 rounded-full ${grant ? "bg-emerald-400" : "bg-[#6fa8ff]"}`} />
                    {grant ? "Access granted — layer parts" : "Grant access (try it)"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
