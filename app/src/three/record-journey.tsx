"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Record Journey — the D9 scroll-driven 3D moment.
 *
 * A single lab-report document travels the evidence chain: it appears, is
 * sealed with its sha-256 digest, passes a consent gate, and lands as a
 * cited claim in a summary. Scroll progress (0..1) drives the scene; there
 * are no controls. Built with plain three/R3F (no drei) to keep the lazy
 * bundle small.
 *
 * R3F is an imperative rendering library: mutating three.js objects inside
 * useFrame is its intended API, so the compiler's immutability lint is
 * scoped off for this file. Geometry/materials are created once and
 * disposed on unmount.
 */
/* eslint-disable react-hooks/immutability */

const C = {
  paper: new THREE.Color("#f7f8f6"),
  paperSunk: new THREE.Color("#eff1ee"),
  pine: new THREE.Color("#14594b"),
  pineDeep: new THREE.Color("#0e4036"),
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** Section-local progress: each beat occupies its scroll band. */
const segment = (p: number, i: number) => clamp01((p - i * 0.25) / 0.25);

function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ------------------------------------------------------------------ */
/* Lab report document — paper sheet with printed rows                  */
/* ------------------------------------------------------------------ */

function DocumentMesh({ progress }: { progress: React.RefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const sealGroup = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const stampRef = useRef<THREE.Mesh>(null);

  const { sheetGeo, sheetMat, sheetTex } = useMemo(() => {
    const tex = canvasTexture(256, 320, (ctx) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 256, 320);
      ctx.fillStyle = "#0e4036";
      ctx.fillRect(24, 22, 120, 9);
      ctx.fillRect(24, 40, 190, 4);
      ctx.fillStyle = "#1b2420";
      ctx.font = "600 15px monospace";
      ctx.fillText("RENAL FUNCTION PANEL", 24, 78);
      ctx.fillStyle = "#5f6b64";
      ctx.font = "10px monospace";
      ctx.fillText("Sunrise Diagnostics · 08 Apr 2026", 24, 96);
      const rows: Array<[string, string, string]> = [
        ["Sodium", "139 mmol/L", "#5f6b64"],
        ["Potassium", "4.8 mmol/L", "#5f6b64"],
        ["Creatinine", "2.0 mg/dL", "#b3261e"],
        ["eGFR", "44 mL/min", "#b3261e"],
        ["Urea", "58 mg/dL", "#5f6b64"],
      ];
      let y = 128;
      for (const [k, v, col] of rows) {
        ctx.strokeStyle = "#e4e8e2";
        ctx.beginPath();
        ctx.moveTo(24, y - 14);
        ctx.lineTo(232, y - 14);
        ctx.stroke();
        ctx.fillStyle = "#1b2420";
        ctx.font = "11px monospace";
        ctx.fillText(k, 24, y);
        ctx.fillStyle = col;
        ctx.fillText(v, 150, y);
        y += 24;
      }
    });
    return {
      sheetGeo: new THREE.PlaneGeometry(2.1, 2.62),
      sheetMat: new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.85,
        metalness: 0,
        transparent: true,
        side: THREE.DoubleSide,
      }),
      sheetTex: tex,
    };
  }, []);

  const { ringGeo, ringMat, stampGeo, stampMat, stampTex } = useMemo(() => {
    const stampTex = canvasTexture(512, 128, (ctx) => {
      ctx.fillStyle = "#14594b";
      ctx.font = "700 40px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✓ sha-256 · 9f86…08f4", 256, 64);
    });
    return {
      ringGeo: new THREE.RingGeometry(0.32, 0.38, 48),
      ringMat: new THREE.MeshBasicMaterial({
        color: C.pine,
        transparent: true,
        side: THREE.DoubleSide,
      }),
      stampGeo: new THREE.PlaneGeometry(1.7, 0.42),
      stampMat: new THREE.MeshBasicMaterial({
        map: stampTex,
        transparent: true,
      }),
      stampTex,
    };
  }, []);

  useEffect(() => {
    return () => {
      sheetGeo.dispose();
      sheetMat.dispose();
      sheetTex.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      stampGeo.dispose();
      stampMat.dispose();
      stampTex.dispose();
    };
  }, [
    sheetGeo,
    sheetMat,
    sheetTex,
    ringGeo,
    ringMat,
    stampGeo,
    stampMat,
    stampTex,
  ]);

  useFrame(() => {
    const p = progress.current ?? 0;
    const appear = smooth(0.0, 0.16, p); // beat 1: document arrives
    const lift = smooth(0.86, 1.0, p); // beat 4: docks into summary
    const g = group.current;
    if (g) {
      g.position.y = -2.4 * (1 - appear) + 0.4 * appear + 0.85 * lift;
      g.position.x = lift * 1.35;
      g.position.z = -0.6 * lift;
      g.rotation.x = -0.45 * (1 - appear) * (1 - lift);
      g.rotation.z = (1 - appear) * 0.35 - 0.1 * lift;
      g.visible = appear > 0.01;
      sheetMat.opacity = 1 - smooth(0.92, 1.0, p) * 0.8;
    }

    // beat 2: hash seal stamps on
    const s = segment(p, 1);
    const sealVis = smooth(0.15, 0.45, s) * (1 - smooth(0.75, 1.0, p));
    const sg = sealGroup.current;
    if (sg) {
      const pop = smooth(0.15, 0.5, s);
      sg.visible = sealVis > 0.01;
      sg.position.set(0.55 + lift * 0.1, 1.0 + pop * 0.15, 0.05);
      sg.scale.setScalar(0.6 + pop * 0.4);
      sg.rotation.z = -0.14 - 0.1 * lift;
    }
    ringMat.opacity = sealVis;
    stampMat.opacity = sealVis;
  });

  return (
    <group ref={group} position={[0, -2.4, 0]}>
      <mesh geometry={sheetGeo} material={sheetMat} />
      <group ref={sealGroup} position={[0.55, 1.0, 0.05]} visible={false}>
        <mesh ref={ringRef} geometry={ringGeo} material={ringMat} position={[0.55, -0.35, 0]} />
        <mesh ref={stampRef} geometry={stampGeo} material={stampMat} position={[-0.25, -0.9, 0]} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Consent gate — two pillars; the record threads between them           */
/* ------------------------------------------------------------------ */

function ConsentGate({ progress }: { progress: React.RefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const leftBar = useRef<THREE.Mesh>(null);
  const rightBar = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const labelRef = useRef<THREE.Sprite>(null);

  const { pillarGeo, pillarMat, beamGeo, beamMat, spriteMat, spriteTex } =
    useMemo(() => {
      const spriteTex = canvasTexture(640, 96, (ctx) => {
        ctx.fillStyle = "#0e4036";
        ctx.fillRect(0, 0, 640, 96);
        ctx.fillStyle = "#e3efea";
        ctx.font = "600 32px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("CONSENT · CARDIOLOGY · EXPIRES 23 AUG", 320, 48);
      });
      return {
        pillarGeo: new THREE.BoxGeometry(0.26, 3.2, 0.26),
        pillarMat: new THREE.MeshStandardMaterial({
          color: C.paperSunk,
          roughness: 0.9,
        }),
        beamGeo: new THREE.BoxGeometry(0.1, 0.1, 1.6),
        beamMat: new THREE.MeshBasicMaterial({
          color: C.pine,
          transparent: true,
        }),
        spriteMat: new THREE.SpriteMaterial({
          map: spriteTex,
          transparent: true,
        }),
        spriteTex,
      };
    }, []);

  useEffect(() => {
    return () => {
      pillarGeo.dispose();
      pillarMat.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      spriteMat.dispose();
      spriteTex.dispose();
    };
  }, [pillarGeo, pillarMat, beamGeo, beamMat, spriteMat, spriteTex]);

  useFrame(() => {
    const p = progress.current ?? 0;
    const g = segment(p, 2); // beat 3: consent gate
    const vis = smooth(0.1, 0.4, g) * (1 - smooth(0.8, 1.0, p));
    const open = smooth(0.35, 0.8, g);
    const grp = group.current;
    if (grp) {
      grp.visible = vis > 0.01;
      grp.position.z = 1.15 - open * 1.15;
    }
    if (leftBar.current) leftBar.current.position.x = -1.5 - open * 0.8;
    if (rightBar.current) rightBar.current.position.x = 1.5 + open * 0.8;
    beamMat.opacity = vis * 0.9;
    if (beam.current) beam.current.scale.x = 0.4 + open * 1.6;
    spriteMat.opacity = vis;
    void labelRef;
  });

  return (
    <group ref={group} position={[0, 0.3, 1.15]} visible={false}>
      <mesh ref={leftBar} geometry={pillarGeo} material={pillarMat} position={[-1.5, 0, 0]} />
      <mesh ref={rightBar} geometry={pillarGeo} material={pillarMat} position={[1.5, 0, 0]} />
      <mesh ref={beam} geometry={beamGeo} material={beamMat} />
      <sprite ref={labelRef} material={spriteMat} position={[0, 2.0, 0]} scale={[2.7, 0.4, 1]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Summary sheet — destination; document docks beside a cited claim      */
/* ------------------------------------------------------------------ */

function SummarySheet({ progress }: { progress: React.RefObject<number> }) {
  const group = useRef<THREE.Group>(null);

  const { geo, mat, tex } = useMemo(() => {
    const tex = canvasTexture(512, 640, (ctx) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 512, 640);
      ctx.strokeStyle = "#e4e8e2";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 510, 638);
      ctx.fillStyle = "#5f6b64";
      ctx.font = "600 22px monospace";
      ctx.fillText("CLINICAL SUMMARY · SBAR", 32, 56);
      ctx.fillStyle = "#14594b";
      ctx.font = "700 20px monospace";
      ctx.fillText("✓ SOURCES LINKED", 32, 88);
      const claims: Array<[string, string]> = [
        ["Situation", "CKD stage 3b — creatinine rising."],
        ["Assessment", "eGFR 44; nephrology referral."],
        ["Plan", "Repeat renal panel in 2 weeks."],
      ];
      let y = 150;
      for (const [k, v] of claims) {
        ctx.fillStyle = "#5f6b64";
        ctx.font = "600 17px monospace";
        ctx.fillText(k.toUpperCase(), 32, y);
        ctx.fillStyle = "#1b2420";
        ctx.font = "24px serif";
        ctx.fillText(v, 32, y + 30);
        for (let c = 0; c < 2; c++) {
          const x = 32 + c * 52;
          ctx.fillStyle = "#e3efea";
          ctx.fillRect(x, y + 46, 44, 30);
          ctx.strokeStyle = "#14594b";
          ctx.strokeRect(x, y + 46, 44, 30);
          ctx.fillStyle = "#0d3a30";
          ctx.font = "700 18px monospace";
          ctx.fillText(String(c + 1), x + 18, y + 67);
        }
        y += 120;
      }
      ctx.fillStyle = "#5f6b64";
      ctx.font = "16px monospace";
      ctx.fillText("Uncited claims are dropped.", 32, 600);
    });
    return {
      geo: new THREE.PlaneGeometry(2.4, 3.0),
      mat: new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.9,
        transparent: true,
      }),
      tex,
    };
  }, []);

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
      tex.dispose();
    };
  }, [geo, mat, tex]);

  useFrame(() => {
    const p = progress.current ?? 0;
    const g = segment(p, 3); // beat 4: cited claim
    const vis = smooth(0.08, 0.45, g);
    const grp = group.current;
    if (grp) {
      grp.visible = vis > 0.01;
      grp.position.set(1.55, 0.35, -1.6 + vis * 0.6);
      grp.rotation.y = -0.4;
    }
    mat.opacity = vis;
  });

  return (
    <group ref={group} position={[1.55, 0.35, -1.6]} visible={false}>
      <mesh geometry={geo} material={mat} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Chain path — faint dotted evidence chain connecting the beats         */
/* ------------------------------------------------------------------ */

function ChainPath({ progress }: { progress: React.RefObject<number> }) {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, material } = useMemo(() => {
    const N = 220;
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.4, 0),
      new THREE.Vector3(0.55, 1.0, 0.1),
      new THREE.Vector3(0.2, 0.5, 0.8),
      new THREE.Vector3(0.8, 0.4, -0.5),
      new THREE.Vector3(1.5, 0.4, -1.2),
    ]);
    const positions = new Float32Array(N * 3);
    path.getSpacedPoints(N - 1).forEach((pt, i) => {
      positions[i * 3] = pt.x;
      positions[i * 3 + 1] = pt.y;
      positions[i * 3 + 2] = pt.z;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: C.pine,
      size: 0.045,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true,
    });
    return { geometry, material };
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame(() => {
    const p = progress.current ?? 0;
    const vis = smooth(0.1, 0.3, p) * (1 - smooth(0.92, 1.0, p) * 0.6);
    material.opacity = vis * 0.45;
    void pointsRef;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

/* ------------------------------------------------------------------ */
/* Camera rig — scroll-scrubbed, gentle; no controls                     */
/* ------------------------------------------------------------------ */

function CameraRig({ progress }: { progress: React.RefObject<number> }) {
  useFrame(({ camera }) => {
    const p = progress.current ?? 0;
    const eased = p * p * (3 - 2 * p);
    camera.position.set(
      Math.sin(eased * Math.PI * 0.5) * 0.85,
      0.8 + eased * 0.55,
      5.4 - eased * 0.8,
    );
    camera.lookAt(eased * 0.65, 0.35 + eased * 0.1, 0);
  });
  return null;
}

function Scene({ progress }: { progress: React.RefObject<number> }) {
  const gl = useThree((s) => s.gl);
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = 1.05;

  return (
    <>
      <color attach="background" args={["#f7f8f6"]} />
      <ambientLight intensity={1.1} color={"#ffffff"} />
      <directionalLight position={[3, 5, 4]} intensity={1.35} color={"#ffffff"} />
      <directionalLight position={[-4, -2, -3]} intensity={0.35} color={"#dfe8e2"} />
      <DocumentMesh progress={progress} />
      <ConsentGate progress={progress} />
      <SummarySheet progress={progress} />
      <ChainPath progress={progress} />
      <CameraRig progress={progress} />
    </>
  );
}

/**
 * The Canvas. `progress` is written by the section's rAF-throttled scroll
 * observer; `active=false` pauses the render loop (offscreen), and the
 * whole canvas stays unmounted until the section nears the viewport.
 */
export function RecordJourneyCanvas({
  progress,
  lowDetail = false,
  active = true,
}: {
  progress: React.RefObject<number>;
  lowDetail?: boolean;
  /** false pauses the render loop entirely (offscreen). */
  active?: boolean;
}) {
  return (
    <Canvas
      aria-hidden
      dpr={[1, 2]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0.8, 5.4], fov: 42, near: 0.1, far: 40 }}
      gl={{ antialias: !lowDetail, powerPreference: "low-power" }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <Scene progress={progress} />
    </Canvas>
  );
}
