"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, RoundedBox, Stars } from "@react-three/drei";

const BEAT_COPY = [
  {
    eyebrow: "Beat 01 · Arrive",
    title: "Your lab report arrives.",
    body: "Pulled from the hospital, into your vault — byte-for-byte, as the instrument printed it.",
  },
  {
    eyebrow: "Beat 02 · Sealed",
    title: "Sealed. Only you hold the key.",
    body: "Hashed with sha-256. One changed byte breaks the seal; the original never moves.",
  },
  {
    eyebrow: "Beat 03 · Gated",
    title: "Gated. Nothing opens without your tap.",
    body: "A clinician waits outside the glass until you grant — narrowly, with an expiry.",
  },
  {
    eyebrow: "Beat 04 · Cited",
    title: "Cited. Every access leaves a receipt.",
    body: "Each summary sentence resolves to a sealed record. A claim without a source is dropped.",
  },
] as const;

function seg(s: number, from: number, to: number): number {
  if (s <= from) return 0;
  if (s >= to) return 1;
  return (s - from) / (to - from);
}

export type VaultProgress = { current: number; granted: boolean };

/** Glass vault capsule + report card, driven by a single scrubbed value s: 0→4. */
function VaultScene({ progress, coarse }: { progress: React.MutableRefObject<VaultProgress>; coarse: boolean }) {
  const group = useRef<THREE.Group>(null);
  const halves = useRef<Array<THREE.Group | null>>([]);
  const ring = useRef<THREE.Mesh>(null);
  const chip = useRef<THREE.Group>(null);

  const mats = useMemo(
    () => ({
      // Physical + clearcoat roughly doubles fragment cost vs standard for
      // a faint blue shell — mobile gets MeshStandardMaterial instead.
      glass: coarse
        ? new THREE.MeshStandardMaterial({
            color: "#3d6fd1",
            transparent: true,
            opacity: 0.32,
            roughness: 0.25,
            metalness: 0.15,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        : new THREE.MeshPhysicalMaterial({
            color: "#3d6fd1",
            transparent: true,
            opacity: 0.28,
            roughness: 0.12,
            metalness: 0.1,
            clearcoat: 1,
            clearcoatRoughness: 0.15,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
      card: new THREE.MeshStandardMaterial({ color: "#dbe7ff", roughness: 0.5 }),
      cardEdge: new THREE.MeshStandardMaterial({ color: "#2e6fe8", roughness: 0.4 }),
      seal: new THREE.MeshStandardMaterial({
        color: "#4d8dff",
        emissive: "#2e6fe8",
        emissiveIntensity: 1.4,
        roughness: 0.3,
      }),
      lock: new THREE.MeshStandardMaterial({
        color: "#8fb4ff",
        emissive: "#1a56c4",
        emissiveIntensity: 0.7,
        roughness: 0.25,
        metalness: 0.6,
      }),
    }),
    [coarse],
  );

  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useFrame((state) => {
    const s = progress.current.current; // 0 → 4
    const granted = progress.current.granted;
    const g = group.current;
    if (!g) return;
    g.rotation.y = s * 0.55 + Math.sin(state.clock.elapsedTime * 0.3) * 0.06;
    g.position.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.05;

    const close = seg(s, 0.7, 1.6);
    const split = seg(s, 2.1, 2.8) * (granted ? 0.25 : 1);
    halves.current.forEach((half, i) => {
      if (!half) return;
      half.position.x = (i === 0 ? -1 : 1) * THREE.MathUtils.lerp(1.6, 0.62, close);
      half.position.y = (i === 0 ? 1 : -1) * split * 0.7;
      half.rotation.z = (i === 0 ? 1 : -1) * split * 0.28;
    });
    if (ring.current) {
      const sealOn = seg(s, 1.2, 2);
      const mat = ring.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.2 + sealOn * (1.6 + Math.sin(state.clock.elapsedTime * 3) * 0.5);
      ring.current.scale.setScalar(0.6 + sealOn * 0.4);
    }
    if (chip.current) {
      const out = seg(s, 3.1, 3.8);
      chip.current.position.set(
        THREE.MathUtils.lerp(0, 1.9, out),
        THREE.MathUtils.lerp(0, 0.6, out),
        THREE.MathUtils.lerp(0, 0.9, out),
      );
      chip.current.scale.setScalar(0.3 + out * 0.7);
    }
  });

  return (
    <group ref={group}>
      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.5}>
        <RoundedBox args={[1.5, 2.1, 0.12]} radius={0.06} material={mats.card} />
        {[-0.6, -0.35, -0.1, 0.15].map((y, i) => (
          <mesh key={i} position={[-0.25 + (i % 2) * 0.12, y, 0.065]} material={mats.cardEdge}>
            <boxGeometry args={[i % 2 ? 0.7 : 1.0, 0.07, 0.01]} />
          </mesh>
        ))}
      </Float>

      {[-1, 1].map((side, i) => (
        <group key={side} ref={(el) => { halves.current[i] = el; }}>
          <mesh material={mats.glass}>
            <cylinderGeometry args={[1.45, 1.45, 2.9, 24, 1, true, side > 0 ? 0 : Math.PI, Math.PI]} />
          </mesh>
          <mesh material={mats.lock} position={[0, 1.15, 1.1]}>
            <sphereGeometry args={[0.09, 16, 16]} />
          </mesh>
        </group>
      ))}

      <mesh ref={ring} material={mats.seal} rotation={[Math.PI / 2, 0, 0]} position={[0, -1.55, 0]}>
        <torusGeometry args={[1.0, 0.05, 12, 48]} />
      </mesh>

      <group ref={chip} scale={0.3}>
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
