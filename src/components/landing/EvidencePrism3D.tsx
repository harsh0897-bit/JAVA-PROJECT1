import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  Lock,
  Network,
  Clock,
  Fingerprint,
  Sparkles,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { DropletTabs } from '../ui/DropletTabs';

export type ArtifactType = 'WORM_SEAL' | 'MULE_NODE' | 'TIMESTAMP_VERIFY';

interface ArtifactMeta {
  id: ArtifactType;
  label: string;
  tag: string;
  badgeColor: string;
  shortDesc: string;
  fullDesc: string;
  technicalCode: string;
  status: string;
}

const ARTIFACT_INFO: Record<ArtifactType, ArtifactMeta> = {
  WORM_SEAL: {
    id: 'WORM_SEAL',
    label: 'Locked file seal',
    tag: 'Evidence protection',
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    shortDesc: 'Digital fingerprint locked the moment a file is added.',
    fullDesc:
      'Every uploaded file is immediately locked so it cannot be changed. Its unique digital fingerprint proves whether even a single character was altered.',
    technicalCode: 'Digital fingerprint: 8f4b1029… · Locked file',
    status: 'Locked – cannot be changed',
  },
  MULE_NODE: {
    id: 'MULE_NODE',
    label: 'Pass-through account',
    tag: 'Connection map',
    badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
    shortDesc: 'Intermediary account moving stolen money between banks.',
    fullDesc:
      'Connection mapping highlights this pass-through account as the central link between the initial scam message and the final offshore transfer.',
    technicalCode: 'Connection score: 94% · 4 linked accounts',
    status: 'Key pass-through account',
  },
  TIMESTAMP_VERIFY: {
    id: 'TIMESTAMP_VERIFY',
    label: 'Photo time check',
    tag: 'Timeline check',
    badgeColor: 'text-blue-700 bg-blue-50 border-blue-200',
    shortDesc: 'Compares hidden photo details against the printed receipt time.',
    fullDesc:
      'Checks the camera’s hidden photo details against the time printed on the payment receipt to spot edited screenshots or forged receipts.',
    technicalCode: 'Camera time: 14:22:08 UTC · Receipt time: 14:22:08 UTC',
    status: 'Times match – authentic',
  },
};

/* =========================================================================
   1. Geometry Generator (Faceted Emerald-Cut Crystal)
   ========================================================================= */

function makeCrystalGeometry(): THREE.BufferGeometry {
  const w = 1.0, d = 0.78, c = 0.34;
  const s = new THREE.Shape();
  s.moveTo(-w + c, -d);
  s.lineTo(w - c, -d);
  s.lineTo(w, -d + c);
  s.lineTo(w, d - c);
  s.lineTo(w - c, d);
  s.lineTo(-w + c, d);
  s.lineTo(-w, d - c);
  s.lineTo(-w, -d + c);
  s.closePath();

  let g: THREE.BufferGeometry = new THREE.ExtrudeGeometry(s, {
    depth: 1.7,
    bevelEnabled: true,
    bevelThickness: 0.28,
    bevelSize: 0.22,
    bevelSegments: 1,
    steps: 1,
  });

  g.rotateX(-Math.PI / 2);
  g.center();
  g = g.toNonIndexed();
  g.computeVertexNormals();
  return g;
}

/* =========================================================================
   2. Procedural Studio Environment Hook
   ========================================================================= */

function useStudioEnv() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const envScene = new THREE.Scene();
    const disposables: Array<{ dispose: () => void }> = [];

    const sphereGeo = new THREE.SphereGeometry(20, 32, 32);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xeaf0fa,
      side: THREE.BackSide,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    envScene.add(sphere);
    disposables.push(sphereGeo, sphereMat);

    const addStrip = (
      w: number,
      h: number,
      color: THREE.ColorRepresentation,
      k: number,
      pos: [number, number, number]
    ) => {
      const geo = new THREE.PlaneGeometry(w, h);
      const c = new THREE.Color(color).multiplyScalar(k);
      const mat = new THREE.MeshBasicMaterial({
        color: c,
        toneMapped: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...pos);
      mesh.lookAt(0, 0, 0);
      envScene.add(mesh);
      disposables.push(geo, mat);
    };

    addStrip(1.5, 14, 0xffffff, 8, [-11, 2, 0]);
    addStrip(1.2, 14, 0x2563eb, 6, [11, 1, 0]);
    addStrip(14, 1.5, 0xffffff, 8, [0, 12, -1]);
    addStrip(10, 0.8, 0x93c5fd, 4, [0, -6, 6]);
    addStrip(1.2, 14, 0x3b82f6, 8, [-4, 3, -9]);

    const pm = new THREE.PMREMGenerator(gl);
    const rt = pm.fromScene(envScene, 0);
    scene.environment = rt.texture;

    return () => {
      if (scene.environment === rt.texture) {
        scene.environment = null;
      }
      rt.dispose();
      pm.dispose();
      disposables.forEach((d) => d.dispose());
    };
  }, [gl, scene]);
}

/* =========================================================================
   3. Light Daylight Background Hook (#F6F8FC -> #EAF0FA)
   ========================================================================= */

function useSceneBackground() {
  const { scene } = useThree();

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0, '#F6F8FC');
      grad.addColorStop(1, '#EAF0FA');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.background = texture;

    return () => {
      if (scene.background === texture) {
        scene.background = null;
      }
      texture.dispose();
    };
  }, [scene]);
}

/* =========================================================================
   4. Opaque Internal Core (Solid Octahedron + Wireframe + Orbit Rings)
   ========================================================================= */

const InternalCore: React.FC<{ reducedMotion: boolean }> = ({ reducedMotion }) => {
  const coreRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const ring3Ref = useRef<THREE.Group>(null);

  const solidGeo = useMemo(() => new THREE.OctahedronGeometry(0.48, 0), []);
  const wireGeo = useMemo(
    () => new THREE.WireframeGeometry(new THREE.OctahedronGeometry(0.62, 0)),
    []
  );
  const torusGeo = useMemo(() => new THREE.TorusGeometry(0.76, 0.008, 16, 64), []);
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.04, 12, 12), []);

  useEffect(() => {
    return () => {
      solidGeo.dispose();
      wireGeo.dispose();
      torusGeo.dispose();
      sphereGeo.dispose();
    };
  }, [solidGeo, wireGeo, torusGeo, sphereGeo]);

  useFrame((state, delta) => {
    if (reducedMotion) return;
    if (coreRef.current) {
      coreRef.current.rotation.y -= delta * 0.45;
      coreRef.current.rotation.z += delta * 0.25;
    }
    const t = state.clock.elapsedTime;
    if (ring1Ref.current) ring1Ref.current.rotation.z = t * 0.6;
    if (ring2Ref.current) ring2Ref.current.rotation.z = -t * 0.5;
    if (ring3Ref.current) ring3Ref.current.rotation.z = t * 0.7;
  });

  return (
    <group position={[0, 0, 0]}>
      <pointLight position={[0, 0, 0]} color="#2563eb" intensity={4} distance={3.5} />

      <group ref={coreRef}>
        <mesh geometry={solidGeo}>
          <meshStandardMaterial
            color="#2563eb"
            roughness={0.25}
            metalness={0.3}
          />
        </mesh>
        <lineSegments geometry={wireGeo}>
          <lineBasicMaterial color="#1d4ed8" linewidth={2} />
        </lineSegments>
      </group>

      <group rotation={[Math.PI / 6, 0, 0]}>
        <mesh geometry={torusGeo}>
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
        <group ref={ring1Ref}>
          <mesh geometry={sphereGeo} position={[0.76, 0, 0]}>
            <meshBasicMaterial color="#2563eb" />
          </mesh>
        </group>
      </group>

      <group rotation={[Math.PI / 3, Math.PI / 4, 0]}>
        <mesh geometry={torusGeo}>
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
        <group ref={ring2Ref}>
          <mesh geometry={sphereGeo} position={[0.76, 0, 0]}>
            <meshBasicMaterial color="#2563eb" />
          </mesh>
        </group>
      </group>

      <group rotation={[Math.PI / 2, 0, Math.PI / 6]}>
        <mesh geometry={torusGeo}>
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
        <group ref={ring3Ref}>
          <mesh geometry={sphereGeo} position={[0.76, 0, 0]}>
            <meshBasicMaterial color="#2563eb" />
          </mesh>
        </group>
      </group>
    </group>
  );
};

/* =========================================================================
   5. Curved Text Bands (Clean Light Ribbon Cards)
   ========================================================================= */

function createTextBandTexture(label: string, sub: string, isHighlighted: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = isHighlighted ? '#EFF6FF' : '#FFFFFF';
    ctx.fillRect(0, 0, 768, 192);

    ctx.strokeStyle = isHighlighted ? '#2563EB' : '#CBD5E1';
    ctx.lineWidth = isHighlighted ? 6 : 4;
    ctx.strokeRect(6, 6, 768 - 12, 192 - 12);

    ctx.fillStyle = '#0F1B33';
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 384, 76);

    ctx.fillStyle = isHighlighted ? '#2563EB' : '#5B6B85';
    ctx.font = '600 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(sub, 384, 134);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const BandMesh: React.FC<{
  label: string;
  sub: string;
  height: number;
  thetaStart: number;
  rotSpeed: number;
  isSelected: boolean;
  reducedMotion: boolean;
}> = ({ label, sub, height, thetaStart, rotSpeed, isSelected, reducedMotion }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const geo = useMemo(
    () => new THREE.CylinderGeometry(0.7, 0.7, 0.32, 40, 1, true, thetaStart, 1.1),
    [thetaStart]
  );
  const texture = useMemo(
    () => createTextBandTexture(label, sub, isSelected),
    [label, sub, isSelected]
  );

  useFrame((_, delta) => {
    if (!meshRef.current || reducedMotion) return;
    meshRef.current.rotation.y += delta * rotSpeed;
  });

  useEffect(() => {
    return () => {
      geo.dispose();
      texture.dispose();
    };
  }, [geo, texture]);

  const targetScale = isSelected ? 1.06 : 1.0;

  return (
    <mesh
      ref={meshRef}
      geometry={geo}
      position={[0, height, 0]}
      scale={[targetScale, targetScale, targetScale]}
    >
      <meshBasicMaterial
        map={texture}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
};

const CurvedTextBands: React.FC<{
  selectedArtifact: ArtifactType;
  reducedMotion: boolean;
}> = ({ selectedArtifact, reducedMotion }) => {
  return (
    <group position={[0, 0, 0]}>
      <BandMesh
        label="Locked file seal"
        sub="Tamper-proof digital fingerprint"
        height={0.35}
        thetaStart={3.35}
        rotSpeed={0.06}
        isSelected={selectedArtifact === 'WORM_SEAL'}
        reducedMotion={reducedMotion}
      />

      <BandMesh
        label="Pass-through account"
        sub="4 linked accounts · 3 steps"
        height={0.45}
        thetaStart={1.95}
        rotSpeed={-0.05}
        isSelected={selectedArtifact === 'MULE_NODE'}
        reducedMotion={reducedMotion}
      />

      <BandMesh
        label="Photo time check"
        sub="Camera vs receipt time match"
        height={-0.45}
        thetaStart={2.45}
        rotSpeed={0.07}
        isSelected={selectedArtifact === 'TIMESTAMP_VERIFY'}
        reducedMotion={reducedMotion}
      />
    </group>
  );
};

/* =========================================================================
   6. Equatorial Scan Ring
   ========================================================================= */

const LaserRing: React.FC<{
  sweepTrigger?: number;
  reducedMotion: boolean;
}> = ({ sweepTrigger = 0, reducedMotion }) => {
  const laserGroupRef = useRef<THREE.Group>(null);
  const sweepStartTimeRef = useRef<number>(-999);

  const mainTorusGeo = useMemo(() => new THREE.TorusGeometry(1.9, 0.014, 24, 80), []);

  useEffect(() => {
    return () => {
      mainTorusGeo.dispose();
    };
  }, [mainTorusGeo]);

  useEffect(() => {
    if (sweepTrigger > 0) {
      sweepStartTimeRef.current = performance.now() / 1000;
    }
  }, [sweepTrigger]);

  useFrame((state) => {
    if (!laserGroupRef.current) return;
    if (reducedMotion) {
      laserGroupRef.current.position.y = 0;
      return;
    }

    const now = performance.now() / 1000;
    const elapsed = now - sweepStartTimeRef.current;

    if (elapsed >= 0 && elapsed <= 2.4) {
      if (elapsed < 0.2) {
        const p = elapsed / 0.2;
        laserGroupRef.current.position.y = THREE.MathUtils.lerp(0, -1.1, p);
      } else {
        const sweepProgress = (elapsed - 0.2) / 2.2;
        if (sweepProgress <= 0.5) {
          const u = sweepProgress / 0.5;
          const ease = (1 - Math.cos(Math.PI * u)) / 2;
          laserGroupRef.current.position.y = -1.1 + 2.2 * ease;
        } else {
          const v = (sweepProgress - 0.5) / 0.5;
          const ease = (1 - Math.cos(Math.PI * v)) / 2;
          laserGroupRef.current.position.y = 1.1 - 1.1 * ease;
        }
      }
    } else {
      laserGroupRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.2;
    }
  });

  return (
    <group ref={laserGroupRef} position={[0, 0, 0]}>
      <mesh geometry={mainTorusGeo} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#2563EB" />
      </mesh>
    </group>
  );
};

/* =========================================================================
   7. Light Brushed Pedestal Podium
   ========================================================================= */

const Podium: React.FC = () => {
  const cylinderGeo = useMemo(() => new THREE.CylinderGeometry(1.8, 2.1, 0.25, 64), []);
  const edgeTorusGeo = useMemo(() => new THREE.TorusGeometry(1.8, 0.012, 16, 64), []);

  useEffect(() => {
    return () => {
      cylinderGeo.dispose();
      edgeTorusGeo.dispose();
    };
  }, [cylinderGeo, edgeTorusGeo]);

  return (
    <group position={[0, -1.36, 0]}>
      <mesh geometry={cylinderGeo}>
        <meshStandardMaterial
          color="#DCE6F5"
          metalness={0.15}
          roughness={0.65}
        />
      </mesh>
      <mesh geometry={edgeTorusGeo} position={[0, 0.125, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#93C5FD" />
      </mesh>
    </group>
  );
};

/* =========================================================================
   8. Chunky Emerald-Cut Glass Crystal Body
   ========================================================================= */

const CrystalPrism: React.FC = () => {
  const crystalGeo = useMemo(() => makeCrystalGeometry(), []);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(crystalGeo, 15), [crystalGeo]);

  useEffect(() => {
    return () => {
      crystalGeo.dispose();
      edgesGeo.dispose();
    };
  }, [crystalGeo, edgesGeo]);

  return (
    <group position={[0, 0, 0]}>
      <mesh geometry={crystalGeo}>
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={0.96}
          thickness={1.22}
          ior={1.55}
          roughness={0.05}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.05}
          attenuationColor="#dbeafe"
          attenuationDistance={3.9}
          envMapIntensity={1.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial
          color="#60a5fa"
          transparent
          opacity={0.45}
        />
      </lineSegments>
    </group>
  );
};

/* =========================================================================
   9. Main Interactive 3D Stage Composition
   ========================================================================= */

interface PrismSceneProps {
  reducedMotion: boolean;
  isDraggingRef: React.MutableRefObject<boolean>;
  targetRotRef: React.MutableRefObject<{ x: number; y: number }>;
}

const PrismScene: React.FC<PrismSceneProps> = ({
  reducedMotion,
  isDraggingRef,
  targetRotRef,
}) => {
  useStudioEnv();
  useSceneBackground();

  const { camera, size } = useThree();
  const crystalRotGroupRef = useRef<THREE.Group>(null);
  const currentRotRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useFrame((_, delta) => {
    // Frame crystal so projected bounds fill ~45%–49% (target 42%–50%) of usable card height
    // with generous top/bottom/side margins across full 360-degree rotation on desktop & mobile.
    const aspect = size.width / Math.max(1, size.height);
    const camZ = aspect < 1.05 ? 6.5 / Math.max(0.78, aspect * 0.95) : 6.5;
    if (Math.abs(camera.position.z - camZ) > 0.01 || Math.abs(camera.position.y - 0.02) > 0.01) {
      camera.position.set(0, 0.02, camZ);
      camera.lookAt(0, -0.04, 0);
      camera.updateProjectionMatrix();
    }

    if (!crystalRotGroupRef.current) return;

    if (!reducedMotion && !isDraggingRef.current) {
      targetRotRef.current.y += delta * 0.22;
    }

    currentRotRef.current.x = THREE.MathUtils.lerp(
      currentRotRef.current.x,
      targetRotRef.current.x,
      0.08
    );
    currentRotRef.current.y = THREE.MathUtils.lerp(
      currentRotRef.current.y,
      targetRotRef.current.y,
      0.08
    );

    crystalRotGroupRef.current.rotation.x = currentRotRef.current.x;
    crystalRotGroupRef.current.rotation.y = currentRotRef.current.y;
  });

  return (
    <>
      <ambientLight intensity={0.85} color="#ffffff" />
      <directionalLight position={[4, 8, 4]} intensity={1.8} color="#ffffff" />
      <directionalLight position={[-4, -3, -4]} intensity={0.8} color="#93c5fd" />

      <group ref={crystalRotGroupRef} position={[0, 0.08, 0]} scale={0.82}>
        <InternalCore reducedMotion={reducedMotion} />
        <CrystalPrism />
      </group>

      <group position={[0, 0.08, 0]} scale={0.82}>
        <LaserRing reducedMotion={reducedMotion} />
      </group>
      <group position={[0, 0.08, 0]} scale={0.82}>
        <Podium />
      </group>
    </>
  );
};

/* =========================================================================
   10. Repeating Scanning -> Ready Status Line below Crystal (E2)
   ========================================================================= */

// Illustrative constant for the homepage hero card status sequence.
// Uses truthful completed wording "Fingerprint ready" rather than "Fingerprint verified".
const ILLUSTRATIVE_FINGERPRINT_SAMPLE = '8f4b1029c3d4e8a1';

export const ScanningStatusLine: React.FC<{
  reducedMotion: boolean;
  isReady?: boolean;
}> = ({ reducedMotion, isReady = true }) => {
  const [phase, setPhase] = useState<'scanning' | 'ready'>(() =>
    reducedMotion ? 'ready' : 'scanning'
  );
  const [tabVisible, setTabVisible] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
  );
  const hexSpanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const onVisChange = () => {
      setTabVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setPhase('ready');
      if (hexSpanRef.current) {
        hexSpanRef.current.textContent = ILLUSTRATIVE_FINGERPRINT_SAMPLE;
      }
      return;
    }

    if (!isReady || !tabVisible) {
      return;
    }

    let cancelled = false;
    let scrambleIntervalId: number | null = null;
    let phaseTimeoutId: number | null = null;

    const clearTimers = () => {
      if (scrambleIntervalId !== null) {
        window.clearInterval(scrambleIntervalId);
        scrambleIntervalId = null;
      }
      if (phaseTimeoutId !== null) {
        window.clearTimeout(phaseTimeoutId);
        phaseTimeoutId = null;
      }
    };

    const startScanningPhase = () => {
      if (cancelled) return;
      clearTimers();
      setPhase('scanning');
      if (hexSpanRef.current) {
        hexSpanRef.current.textContent = ILLUSTRATIVE_FINGERPRINT_SAMPLE;
      }

      // Update hex text at ~10.5 Hz (within 8-12 Hz) via DOM ref without calling React setState per frame
      scrambleIntervalId = window.setInterval(() => {
        if (!hexSpanRef.current) return;
        const p1 = Math.floor(Math.random() * 0xffffffff)
          .toString(16)
          .padStart(8, '0');
        const p2 = Math.floor(Math.random() * 0xffffffff)
          .toString(16)
          .padStart(8, '0');
        hexSpanRef.current.textContent = `${p1}${p2}`;
      }, 95);

      // Hold scanning phase for 3.0s (2.5-3.2s), then cross-fade to ready
      phaseTimeoutId = window.setTimeout(() => {
        if (cancelled) return;
        if (scrambleIntervalId !== null) {
          window.clearInterval(scrambleIntervalId);
          scrambleIntervalId = null;
        }
        if (hexSpanRef.current) {
          hexSpanRef.current.textContent = ILLUSTRATIVE_FINGERPRINT_SAMPLE;
        }
        setPhase('ready');

        // Hold ready phase for 1.8s (1.5-2.0s), then repeat cleanly
        phaseTimeoutId = window.setTimeout(() => {
          if (!cancelled) {
            startScanningPhase();
          }
        }, 1800);
      }, 3000);
    };

    startScanningPhase();

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [reducedMotion, isReady, tabVisible]);

  const isReadyState = reducedMotion || phase === 'ready';

  return (
    <div className="relative z-10 h-11 min-h-[44px] px-4 bg-white/95 border-t border-slate-200/80 flex items-center justify-center gap-2.5 text-xs select-none shrink-0">
      <span className="sr-only">Illustrative SHA-256 fingerprint preview</span>

      {/* Stacked fixed-width/height state labels so cross-fade never changes layout height or shifts siblings */}
      <div className="relative grid items-center justify-items-start min-w-[216px] h-5">
        <span
          aria-hidden={isReadyState ? 'true' : undefined}
          className={`col-start-1 row-start-1 inline-flex items-center gap-2 transition-opacity duration-300 ${
            isReadyState ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <span
            className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0"
            aria-hidden="true"
          />
          <span className="font-sans font-medium text-slate-600 whitespace-nowrap">
            Scanning SHA-256 fingerprint…
          </span>
        </span>

        <span
          aria-hidden={!isReadyState ? 'true' : undefined}
          className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 transition-opacity duration-300 ${
            isReadyState ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <CheckCircle2
            className="w-3.5 h-3.5 text-emerald-600 shrink-0"
            aria-hidden="true"
          />
          <span className="font-sans font-semibold text-emerald-700 whitespace-nowrap">
            Fingerprint ready
          </span>
        </span>
      </div>

      <span
        ref={hexSpanRef}
        aria-hidden="true"
        className={`font-mono font-semibold tracking-wider tabular-nums inline-block w-[16ch] text-center transition-colors duration-300 ${
          isReadyState ? 'text-slate-500' : 'text-blue-700'
        }`}
      >
        {ILLUSTRATIVE_FINGERPRINT_SAMPLE}
      </span>
    </div>
  );
};

/* =========================================================================
   11. Static CSS/SVG Fallback Component (Calm Light Card)
   ========================================================================= */

export const EvidencePrismFallback: React.FC<{ reducedMotion?: boolean }> = ({
  reducedMotion = false,
}) => {
  return (
    <div
      className="cf-card relative w-full h-full min-h-[460px] flex flex-col justify-between rounded-[20px] overflow-hidden text-slate-900 bg-white"
      style={{
        boxShadow:
          '0 1px 2px rgba(15,23,42,0.06), 0 12px 28px -10px rgba(37,99,235,0.12), inset 0 1px 0 rgba(255,255,255,0.92)',
      }}
    >
      <div className="relative flex-1 h-[416px] flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#F6F8FC] to-[#EAF0FA]">
        {/* E1(a): Subtle cool-blue radial light behind the prism (peak alpha <= 0.18) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 44%, rgba(59,130,246,0.16) 0%, rgba(147,197,253,0.08) 42%, rgba(234,240,250,0) 72%)',
          }}
        />
        {/* E1(b): Soft grounding shadow ellipse beneath the prism */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 bottom-9 -translate-x-1/2 w-56 h-7 rounded-full"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(30,58,138,0.16) 0%, rgba(37,99,235,0.06) 55%, rgba(37,99,235,0) 80%)',
            filter: 'blur(6px)',
          }}
        />
        <svg
          className="relative z-10 w-56 h-56 text-blue-600/90 drop-shadow-sm"
          viewBox="0 0 200 200"
          fill="none"
          stroke="currentColor"
        >
          <polygon
            points="70,25 130,25 165,55 165,145 130,175 70,175 35,145 35,55"
            strokeWidth="2"
          />
          <polygon
            points="100,60 140,100 100,140 60,100"
            strokeWidth="1.5"
          />
          <ellipse cx="100" cy="100" rx="85" ry="16" strokeWidth="1.5" />
        </svg>
      </div>

      <ScanningStatusLine reducedMotion={reducedMotion} isReady={true} />
    </div>
  );
};

/* =========================================================================
   12. Exported Main EvidencePrism3D Component (Calm Light Card)
   ========================================================================= */

export interface EvidencePrism3DProps {
  onRunGlobalVerify?: () => void;
  className?: string;
}

export const EvidencePrism3D: React.FC<EvidencePrism3DProps> = ({
  className = '',
}) => {
  const [webglSupported, setWebglSupported] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [sceneReady, setSceneReady] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const targetRotRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) {
        setWebglSupported(false);
      }
    } catch {
      setWebglSupported(false);
    }

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(motionQuery.matches);
    const handleMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    motionQuery.addEventListener('change', handleMotionChange);

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      observer.disconnect();
    };
  }, []);

  const handleCreated = useCallback(({ gl, camera }: { gl: THREE.WebGLRenderer; camera: THREE.Camera }) => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    if ('transmissionResolutionScale' in gl) {
      gl.transmissionResolutionScale = 0.75;
    }
    camera.lookAt(0, -0.04, 0);
    setSceneReady(true);
    const dom = gl.domElement;
    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglSupported(false);
    };
    dom.addEventListener('webglcontextlost', onContextLost, false);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };

    targetRotRef.current.y += dx * 0.008;
    targetRotRef.current.x = Math.max(
      -0.35,
      Math.min(0.35, targetRotRef.current.x + dy * 0.005)
    );
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  if (!webglSupported) {
    return <EvidencePrismFallback reducedMotion={reducedMotion} />;
  }

  return (
    <div
      ref={containerRef}
      className={`cf-card relative rounded-[20px] overflow-hidden flex flex-col justify-between text-slate-900 bg-white border border-slate-200/80 ${className}`.trim()}
      style={{
        minHeight: '460px',
        boxShadow:
          '0 1px 2px rgba(15,23,42,0.06), 0 12px 28px -10px rgba(37,99,235,0.12), inset 0 1px 0 rgba(255,255,255,0.92)',
      }}
    >
      {/* E1(c): Subtle top-edge inner highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/95 z-20"
      />

      {/* 3D WebGL Canvas Stage */}
      <div
        className="relative w-full h-[380px] sm:h-[416px] overflow-hidden select-none cursor-grab active:cursor-grabbing bg-gradient-to-b from-[#F6F8FC] to-[#EAF0FA]"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* E1(a): Subtle cool-blue radial light behind/over the prism stage (peak alpha <= 0.18) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              'radial-gradient(circle at 50% 42%, rgba(59,130,246,0.14) 0%, rgba(147,197,253,0.06) 44%, rgba(234,240,250,0) 74%)',
          }}
        />

        {/* E1(b): Soft grounding shadow ellipse beneath the prism */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 bottom-6 -translate-x-1/2 w-60 h-7 rounded-full z-10"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(30,58,138,0.15) 0%, rgba(37,99,235,0.05) 56%, rgba(37,99,235,0) 82%)',
            filter: 'blur(5px)',
          }}
        />

        <Canvas
          camera={{ position: [0, 0.02, 6.5], fov: 35 }}
          dpr={[1, 1.75]}
          frameloop={isVisible ? 'always' : 'never'}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
          onCreated={handleCreated}
          className="w-full h-full"
        >
          <PrismScene
            reducedMotion={reducedMotion}
            isDraggingRef={isDraggingRef}
            targetRotRef={targetRotRef}
          />
        </Canvas>
      </div>

      {/* Restrained single repeating status line below crystal */}
      <ScanningStatusLine reducedMotion={reducedMotion} isReady={sceneReady && isVisible} />
    </div>
  );
};

export default EvidencePrism3D;


