"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Sapphire Vault — luxury 3D hero.
 *
 * A glassy hexagonal vault seal (the MediLink mark, in 3D) floats above an
 * orbiting constellation of "record" shards. Pointer movement parallaxes the
 * camera; a slow auto-rotation keeps it alive without input. Everything is
 * procedural — no external assets, no drei. Reduced-motion users get a
 * static, still-beautiful frame (no rotation, no drift).
 */
/* eslint-disable react-hooks/immutability */

const BLUE = {
  bright: new THREE.Color("#6FA8FF"),
  mid: new THREE.Color("#2E6FE8"),
  deep: new THREE.Color("#12429E"),
  ice: new THREE.Color("#BFD9FF"),
};

function hexPrismGeometry(radius: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const x = radius * Math.cos(a);
    const y = radius * Math.sin(a);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.18,
    bevelSize: radius * 0.06,
    bevelSegments: 2,
    curveSegments: 1,
  });
  geo.center();
  return geo;
}

/** The central vault seal. */
function VaultSeal({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => hexPrismGeometry(1.15, 0.22), []);

  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    if (!reduced) {
      group.current.rotation.y += delta * 0.35;
      group.current.position.y = Math.sin(t * 0.8) * 0.08;
      group.current.rotation.x = Math.sin(t * 0.5) * 0.06;
    }
    if (ring.current) {
      ring.current.rotation.z = -t * 0.12;
      const m = ring.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.28 + Math.sin(t * 1.4) * 0.08;
    }
  });

  return (
    <group ref={group}>
      {/* Glass body */}
      <mesh geometry={geo}>
        <meshPhysicalMaterial
          color={BLUE.mid}
          metalness={0.15}
          roughness={0.12}
          transmission={0.72}
          thickness={1.4}
          clearcoat={1}
          clearcoatRoughness={0.25}
          ior={1.42}
          envMapIntensity={1.1}
        />
      </mesh>
      {/* Facet edges */}
      <lineSegments>
        <edgesGeometry args={[geo]} />
        <lineBasicMaterial color={BLUE.ice} transparent opacity={0.65} />
      </lineSegments>
      {/* Inner chain-link M suggestion: two angled bars + node */}
      <group position={[0, 0, 0.16]}>
        <mesh position={[-0.34, -0.05, 0]} rotation={[0, 0, 0.62]}>
          <capsuleGeometry args={[0.055, 0.62, 4, 10]} />
          <meshStandardMaterial color="#ffffff" emissive={BLUE.ice} emissiveIntensity={0.55} roughness={0.3} />
        </mesh>
        <mesh position={[0.34, -0.05, 0]} rotation={[0, 0, -0.62]}>
          <capsuleGeometry args={[0.055, 0.62, 4, 10]} />
          <meshStandardMaterial color="#ffffff" emissive={BLUE.ice} emissiveIntensity={0.55} roughness={0.3} />
        </mesh>
        <mesh>
          <torusGeometry args={[0.17, 0.038, 10, 32]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={BLUE.bright}
            emissiveIntensity={0.8}
            roughness={0.2}
          />
        </mesh>
      </group>
      {/* Halo ring */}
      <mesh ref={ring} position={[0, 0, -0.25]}>
        <ringGeometry args={[1.7, 1.78, 64]} />
        <meshBasicMaterial color={BLUE.bright} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

type ShardSeed = {
  angle: number;
  radius: number;
  height: number;
  speed: number;
  scale: number;
  tilt: number;
};

/** Orbiting record shards — small frosted slabs circling the vault. */
function Shards({ count, reduced }: { count: number; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const seeds = useMemo<ShardSeed[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        angle: (i / count) * Math.PI * 2 + (i % 3) * 0.35,
        radius: 2.5 + ((i * 37) % 19) / 10,
        height: (((i * 53) % 23) - 11) / 9,
        speed: 0.1 + ((i * 17) % 13) / 90,
        scale: 0.09 + ((i * 29) % 11) / 110,
        tilt: ((i * 41) % 30) / 20,
      })),
    [count],
  );
  const geo = useMemo(() => hexPrismGeometry(1, 0.28), []);
  const refs = useRef<Array<THREE.Mesh | null>>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((m, i) => {
      if (!m) return;
      const s = seeds[i]!;
      const a = s.angle + (reduced ? 0 : t * s.speed);
      m.position.set(Math.cos(a) * s.radius, s.height + (reduced ? 0 : Math.sin(t * 0.6 + i) * 0.07), Math.sin(a) * s.radius);
      m.rotation.set(s.tilt + (reduced ? 0 : t * 0.2), a, 0);
    });
    if (!reduced && group.current) group.current.rotation.y = t * 0.02;
  });

  return (
    <group ref={group}>
      {seeds.map((s, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          geometry={geo}
          scale={s.scale}
        >
          <meshPhysicalMaterial
            color={i % 4 === 0 ? BLUE.ice : BLUE.deep}
            metalness={0.1}
            roughness={0.22}
            transmission={0.5}
            thickness={0.5}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Slow pointer parallax on the camera. */
function CameraRig({ reduced }: { reduced: boolean }) {
  const { camera } = useThree();
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth - 0.5) * 0.9;
      target.current.y = (e.clientY / window.innerHeight - 0.5) * 0.5;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced]);

  useFrame(() => {
    if (reduced) return;
    camera.position.x += (target.current.x * 1.6 - camera.position.x) * 0.03;
    camera.position.y += (-target.current.y * 0.9 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export function VaultHero() {
  const wrap = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capability probes + lazy-mount flag: browser-only values that cannot exist during SSR
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    // Lazy-mount the canvas when near viewport (saves main-thread + GPU).
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && setVisible(true),
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0" aria-hidden>
      {visible ? (
        <Canvas
          dpr={[1, 1.75]}
          camera={{ position: [0, 0.4, 5.4], fov: 42 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "transparent" }}
        >
          <ambientLight intensity={0.55} />
          <pointLight position={[4, 3, 5]} intensity={26} color="#8FBAFF" />
          <pointLight position={[-5, -2, 3]} intensity={14} color="#12429E" />
          <spotLight position={[0, 6, 2]} angle={0.5} penumbra={1} intensity={20} color="#ffffff" />
          <VaultSeal reduced={reduced} />
          <Shards count={16} reduced={reduced} />
          <CameraRig reduced={reduced} />
        </Canvas>
      ) : null}
    </div>
  );
}
