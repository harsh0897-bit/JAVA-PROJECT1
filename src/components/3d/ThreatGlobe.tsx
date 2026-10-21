import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import land110 from 'world-atlas/land-110m.json';
import { RotateCcw, ArrowRight, Globe, X } from 'lucide-react';
import { ExtractedEntity } from '../../types';

export interface ThreatGlobeProps {
  entities?: ExtractedEntity[];
  onInspectGraph: () => void;
}

export interface GlobeMarker {
  id: string;
  country: string;
  lat: number;
  lon: number;
  role: string;
  color: string;
  count: string;
  keyAddress: string;
  whatHappened: string;
}

export const GLOBE_MARKERS: GlobeMarker[] = [
  {
    id: 'de',
    country: 'Germany',
    lat: 51.2,
    lon: 10.4,
    role: 'Control server',
    color: '#DC2626',
    count: '18.2k',
    keyAddress: '185.220.101.44',
    whatHappened:
      'Main control server in Frankfurt that coordinated the fake verification text and routed stolen funds across borders.',
  },
  {
    id: 'in',
    country: 'India',
    lat: 20.6,
    lon: 78.9,
    role: 'Where it started',
    color: '#2563EB',
    count: '9.6k',
    keyAddress: 'apex.verify.settlement@okaxis',
    whatHappened:
      'Victim received the scam text message here and money was first pulled into a local pass-through bank account.',
  },
  {
    id: 'ru',
    country: 'Russia',
    lat: 61.5,
    lon: 90.0,
    role: 'Relay network',
    color: '#64748B',
    count: '14.1k',
    keyAddress: '91.214.124.88',
    whatHappened:
      'Forwarded automated login requests through proxy servers to hide the operator’s real location.',
  },
  {
    id: 'us',
    country: 'United States',
    lat: 38.0,
    lon: -97.0,
    role: 'Phishing site host',
    color: '#64748B',
    count: '16.4k',
    keyAddress: 'secure-kyc-update.com',
    whatHappened:
      'Hosted the fake banking web page that captured the victim’s one-time security code.',
  },
  {
    id: 'br',
    country: 'Brazil',
    lat: -14.2,
    lon: -51.9,
    role: 'Regional traffic',
    color: '#64748B',
    count: '6.6k',
    keyAddress: '177.54.144.19',
    whatHappened:
      'Backup relay computers used to test stolen account logins from a different region.',
  },
  {
    id: 'cn',
    country: 'China',
    lat: 35.9,
    lon: 104.2,
    role: 'Offshore cashout',
    color: '#64748B',
    count: '12.9k',
    keyAddress: 'TQn9Y2khEsLJW1ChV…',
    whatHappened:
      'Final destination where funds were converted into digital currency and moved out of reach.',
  },
];

const GLOBE_ARCS: Array<{ from: string; to: string; delay: number }> = [
  { from: 'in', to: 'de', delay: 0.0 },
  { from: 'de', to: 'us', delay: 0.6 },
  { from: 'de', to: 'ru', delay: 1.2 },
  { from: 'de', to: 'br', delay: 1.8 },
];

const R = 1.0;

/**
 * Convert (lat, lon) in degrees to 3D Vector3 on sphere of radius r
 */
export function latLonToVec3(lat: number, lon: number, r: number = R): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/**
 * Rasterize world-atlas land-110m onto an offscreen 2D canvas once at module load
 * and sample ~11,000 land dot positions + normals on the unit sphere.
 */
interface LandDotSample {
  pos: THREE.Vector3;
  normal: THREE.Vector3;
}

let cachedLandDots: LandDotSample[] | null = null;

function getLandDotSamples(): LandDotSample[] {
  if (cachedLandDots) return cachedLandDots;
  if (typeof document === 'undefined') return [];

  const W = 720;
  const H = 360;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  const projection = geoEquirectangular()
    .scale(W / (2 * Math.PI))
    .translate([W / 2, H / 2]);
  const pathGen = geoPath(projection, ctx);
  const landGeo = feature(land110 as any, (land110 as any).objects.land);

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  pathGen(landGeo as any);
  ctx.fill();

  const img = ctx.getImageData(0, 0, W, H).data;
  const samples: LandDotSample[] = [];

  // Sample on a regular spherical grid so dots have uniform density near poles and equator
  const latSteps = 105;
  for (let i = 1; i < latSteps; i++) {
    const lat = 90 - (i / latSteps) * 180;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const lonSteps = Math.max(12, Math.round(210 * cosLat));
    for (let j = 0; j < lonSteps; j++) {
      const lon = -180 + (j / lonSteps) * 360;
      const x = Math.min(W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * W)));
      const y = Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H)));
      const idx = (y * W + x) * 4;
      if (img[idx] > 128) {
        const normal = latLonToVec3(lat, lon, 1.0).normalize();
        const pos = normal.clone().multiplyScalar(R * 1.002);
        samples.push({ pos, normal });
      }
    }
  }

  cachedLandDots = samples;
  return samples;
}

/**
 * Build latitude/longitude grid line segments every 30 degrees
 */
function buildGraticuleGeometry(): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  const r = R * 1.001;

  // Latitudes every 30 deg (-60, -30, 0, 30, 60)
  for (const lat of [-60, -30, 0, 30, 60]) {
    const segs = 96;
    for (let i = 0; i < segs; i++) {
      const lon1 = -180 + (i / segs) * 360;
      const lon2 = -180 + ((i + 1) / segs) * 360;
      points.push(latLonToVec3(lat, lon1, r), latLonToVec3(lat, lon2, r));
    }
  }

  // Longitudes every 30 deg
  for (let lon = -180; lon < 180; lon += 30) {
    const segs = 64;
    for (let i = 0; i < segs; i++) {
      const lat1 = -80 + (i / segs) * 160;
      const lat2 = -80 + ((i + 1) / segs) * 160;
      points.push(latLonToVec3(lat1, lon, r), latLonToVec3(lat2, lon, r));
    }
  }

  return new THREE.BufferGeometry().setFromPoints(points);
}

/**
 * Instanced Dotted Continents (1 draw call)
 */
const DottedContinents: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const samples = useMemo(() => getLandDotSamples(), []);
  const dotGeo = useMemo(() => new THREE.CircleGeometry(0.0085, 6), []);
  const dotMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#7C93BC',
        side: THREE.DoubleSide,
      }),
    []
  );

  useEffect(() => {
    if (!meshRef.current || samples.length === 0) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < samples.length; i++) {
      const { pos, normal } = samples[i];
      dummy.position.copy(pos);
      dummy.lookAt(pos.clone().add(normal));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [samples]);

  useEffect(() => {
    return () => {
      dotGeo.dispose();
      dotMat.dispose();
    };
  }, [dotGeo, dotMat]);

  if (samples.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[dotGeo, dotMat, samples.length]}
      frustumCulled={false}
    />
  );
};

/**
 * 6 Country Markers + 2.5s Expanding Surface Rings
 */
const CountryMarkers3D: React.FC<{
  selectedId: string | null;
  onSelectMarker: (marker: GlobeMarker) => void;
  reducedMotion: boolean;
}> = ({ selectedId, onSelectMarker, reducedMotion }) => {
  const ringRefs = useRef<Array<THREE.Mesh | null>>([]);
  const pinGeo = useMemo(() => new THREE.SphereGeometry(0.022, 16, 16), []);
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.03, 0.038, 32), []);

  useEffect(() => {
    return () => {
      pinGeo.dispose();
      ringGeo.dispose();
    };
  }, [pinGeo, ringGeo]);

  const markerData = useMemo(() => {
    return GLOBE_MARKERS.map((m) => {
      const normal = latLonToVec3(m.lat, m.lon, 1.0).normalize();
      const pos = normal.clone().multiplyScalar(R * 1.006);
      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        normal
      );
      return { ...m, pos, normal, quat };
    });
  }, []);

  useFrame((state) => {
    if (reducedMotion) return;
    const t = state.clock.elapsedTime;
    markerData.forEach((_, idx) => {
      const ring = ringRefs.current[idx];
      if (!ring) return;
      const phase = ((t + idx * 0.4) % 2.5) / 2.5;
      const scale = 1.0 + phase * 1.6;
      ring.scale.set(scale, scale, 1);
      const mat = ring.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = (1 - phase) * 0.65;
      }
    });
  });

  return (
    <group>
      {markerData.map((m, idx) => {
        const isSelected = selectedId === m.id;
        return (
          <group key={m.id}>
            {/* Pin Dot */}
            <mesh
              geometry={pinGeo}
              position={m.pos}
              scale={isSelected ? [1.35, 1.35, 1.35] : [1, 1, 1]}
              onClick={(e) => {
                e.stopPropagation();
                onSelectMarker(m);
              }}
            >
              <meshBasicMaterial color={m.color} />
            </mesh>

            {/* Expanding Surface Ring */}
            <mesh
              ref={(el) => {
                ringRefs.current[idx] = el;
              }}
              geometry={ringGeo}
              position={m.pos}
              quaternion={m.quat}
            >
              <meshBasicMaterial
                color={m.color}
                transparent
                opacity={0.55}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

/**
 * 4 Hub-and-Spoke Connection Arcs with Bouncing Packet Dot + Short Fading Tail
 */
const ConnectionArcs3D: React.FC<{ reducedMotion: boolean }> = ({ reducedMotion }) => {
  const packetRefs = useRef<Array<THREE.Mesh | null>>([]);
  const tail1Refs = useRef<Array<THREE.Mesh | null>>([]);
  const tail2Refs = useRef<Array<THREE.Mesh | null>>([]);

  const dotGeo = useMemo(() => new THREE.SphereGeometry(0.016, 12, 12), []);
  const tail1Geo = useMemo(() => new THREE.SphereGeometry(0.012, 10, 10), []);
  const tail2Geo = useMemo(() => new THREE.SphereGeometry(0.008, 8, 8), []);

  const arcs = useMemo(() => {
    return GLOBE_ARCS.map((arc) => {
      const mFrom = GLOBE_MARKERS.find((m) => m.id === arc.from)!;
      const mTo = GLOBE_MARKERS.find((m) => m.id === arc.to)!;
      const startVec = latLonToVec3(mFrom.lat, mFrom.lon, R * 1.006);
      const endVec = latLonToVec3(mTo.lat, mTo.lon, R * 1.006);
      const arcLength = startVec.distanceTo(endVec);
      const midVec = startVec
        .clone()
        .add(endVec)
        .multiplyScalar(0.5)
        .normalize()
        .multiplyScalar(R * (1 + 0.18 * arcLength));

      const curve = new THREE.QuadraticBezierCurve3(startVec, midVec, endVec);
      const lineGeo = new THREE.TubeGeometry(curve, 48, 0.0045, 6, false);

      return {
        ...arc,
        curve,
        lineGeo,
      };
    });
  }, []);

  useEffect(() => {
    return () => {
      dotGeo.dispose();
      tail1Geo.dispose();
      tail2Geo.dispose();
      arcs.forEach((a) => a.lineGeo.dispose());
    };
  }, [dotGeo, tail1Geo, tail2Geo, arcs]);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    const speed = Math.PI / 2.8; // ~2.8 seconds per pass

    arcs.forEach((arc, idx) => {
      const tRaw = elapsed - arc.delay;
      const u = reducedMotion ? 0.5 : 0.5 - 0.5 * Math.cos(tRaw * speed);
      const dir = Math.sin(tRaw * speed) >= 0 ? 1 : -1;

      const headMesh = packetRefs.current[idx];
      if (headMesh) {
        arc.curve.getPoint(u, headMesh.position);
      }

      const tail1Mesh = tail1Refs.current[idx];
      if (tail1Mesh) {
        const u1 = Math.max(0, Math.min(1, u - dir * 0.035));
        arc.curve.getPoint(u1, tail1Mesh.position);
      }

      const tail2Mesh = tail2Refs.current[idx];
      if (tail2Mesh) {
        const u2 = Math.max(0, Math.min(1, u - dir * 0.07));
        arc.curve.getPoint(u2, tail2Mesh.position);
      }
    });
  });

  return (
    <group>
      {arcs.map((arc, idx) => (
        <group key={`${arc.from}-${arc.to}`}>
          {/* Thin static arc (#2563EB at 35% opacity) */}
          <mesh geometry={arc.lineGeo}>
            <meshBasicMaterial color="#2563EB" transparent opacity={0.35} />
          </mesh>

          {/* Bouncing Packet Head */}
          <mesh
            ref={(el) => {
              packetRefs.current[idx] = el;
            }}
            geometry={dotGeo}
          >
            <meshBasicMaterial color="#2563EB" />
          </mesh>

          {/* Short Fading Tail 1 */}
          <mesh
            ref={(el) => {
              tail1Refs.current[idx] = el;
            }}
            geometry={tail1Geo}
          >
            <meshBasicMaterial color="#2563EB" transparent opacity={0.55} />
          </mesh>

          {/* Short Fading Tail 2 */}
          <mesh
            ref={(el) => {
              tail2Refs.current[idx] = el;
            }}
            geometry={tail2Geo}
          >
            <meshBasicMaterial color="#2563EB" transparent opacity={0.25} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/**
 * Main 3D Globe Scene with Intro Zoom (1.7 -> 3.2 over 2.4s), Damped Spherical Drag/Zoom,
 * Auto-Rotation (0.08 rad/s, pauses on drag/hover + 3s cooldown), and Front-Hemisphere Label Projection
 */
interface GlobeSceneProps {
  selectedMarker: GlobeMarker | null;
  onSelectMarker: (m: GlobeMarker | null) => void;
  labelElsRef: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  isHoveringRef: React.MutableRefObject<boolean>;
  isDraggingRef: React.MutableRefObject<boolean>;
  lastInteractionTimeRef: React.MutableRefObject<number>;
  sphericalTargetRef: React.MutableRefObject<{ theta: number; phi: number; radius: number }>;
  sphericalCurrentRef: React.MutableRefObject<{ theta: number; phi: number; radius: number }>;
  introDoneRef: React.MutableRefObject<boolean>;
  reducedMotion: boolean;
}

const easeInOutCubic = (x: number): number =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

const GlobeScene: React.FC<GlobeSceneProps> = ({
  selectedMarker,
  onSelectMarker,
  labelElsRef,
  isHoveringRef,
  isDraggingRef,
  lastInteractionTimeRef,
  sphericalTargetRef,
  sphericalCurrentRef,
  introDoneRef,
  reducedMotion,
}) => {
  const { camera, size } = useThree();
  const introStartRef = useRef<number | null>(null);

  const oceanGeo = useMemo(() => new THREE.SphereGeometry(R, 64, 64), []);
  const rimGeo = useMemo(() => new THREE.SphereGeometry(R * 1.015, 64, 64), []);
  const graticuleGeo = useMemo(() => buildGraticuleGeometry(), []);

  useEffect(() => {
    return () => {
      oceanGeo.dispose();
      rimGeo.dispose();
      graticuleGeo.dispose();
    };
  }, [oceanGeo, rimGeo, graticuleGeo]);

  const markerVecs = useMemo(() => {
    return GLOBE_MARKERS.map((m) => ({
      id: m.id,
      pos: latLonToVec3(m.lat, m.lon, R * 1.02),
      normal: latLonToVec3(m.lat, m.lon, 1.0).normalize(),
    }));
  }, []);

  const projVec = useMemo(() => new THREE.Vector3(), []);
  const camDir = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime;
    if (introStartRef.current === null) {
      introStartRef.current = now;
    }

    // 1. Intro zoom animation (2.4s easeInOutCubic from distance 1.7 to 3.2)
    const introElapsed = now - introStartRef.current;
    if (!introDoneRef.current) {
      if (reducedMotion || introElapsed >= 2.4) {
        introDoneRef.current = true;
        sphericalTargetRef.current.radius = 3.2;
        sphericalCurrentRef.current.radius = 3.2;
      } else {
        const u = easeInOutCubic(Math.min(1, introElapsed / 2.4));
        const r = THREE.MathUtils.lerp(1.7, 3.2, u);
        sphericalTargetRef.current.radius = r;
        sphericalCurrentRef.current.radius = r;
      }
    } else {
      // 2. Slow auto-rotation (0.08 rad/s) when not dragging, not hovering, and >3s since last interaction
      const timeSinceInteract = performance.now() - lastInteractionTimeRef.current;
      if (
        !reducedMotion &&
        !isDraggingRef.current &&
        !isHoveringRef.current &&
        !selectedMarker &&
        timeSinceInteract > 3000
      ) {
        sphericalTargetRef.current.theta += delta * 0.08;
      }
    }

    // Clamp polar angle phi and zoom radius
    sphericalTargetRef.current.phi = Math.max(
      0.35,
      Math.min(Math.PI - 0.35, sphericalTargetRef.current.phi)
    );
    sphericalTargetRef.current.radius = Math.max(
      1.5,
      Math.min(4.5, sphericalTargetRef.current.radius)
    );

    // Smooth damping
    const damp = 0.09;
    sphericalCurrentRef.current.theta = THREE.MathUtils.lerp(
      sphericalCurrentRef.current.theta,
      sphericalTargetRef.current.theta,
      damp
    );
    sphericalCurrentRef.current.phi = THREE.MathUtils.lerp(
      sphericalCurrentRef.current.phi,
      sphericalTargetRef.current.phi,
      damp
    );
    sphericalCurrentRef.current.radius = THREE.MathUtils.lerp(
      sphericalCurrentRef.current.radius,
      sphericalTargetRef.current.radius,
      damp
    );

    const { theta, phi, radius } = sphericalCurrentRef.current;
    camera.position.set(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    // 3. Project 6 2D HTML pill labels and hide when on back of globe (dot(normal, cameraDir) < 0.15)
    camDir.copy(camera.position).normalize();
    for (let i = 0; i < markerVecs.length; i++) {
      const mv = markerVecs[i];
      const el = labelElsRef.current[mv.id];
      if (!el) continue;

      const dotVal = mv.normal.dot(camDir);
      if (dotVal < 0.15) {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      } else {
        // Smooth opacity fade near horizon (0.15 -> 0.35)
        const alpha = Math.min(1, (dotVal - 0.15) / 0.2);
        projVec.copy(mv.pos).project(camera);
        const x = (projVec.x * 0.5 + 0.5) * size.width;
        const y = (-projVec.y * 0.5 + 0.5) * size.height;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -135%)`;
        el.style.opacity = alpha.toFixed(2);
        el.style.pointerEvents = alpha > 0.4 ? 'auto' : 'none';
      }
    }
  });

  return (
    <group>
      <ambientLight intensity={1.35} color="#ffffff" />
      <directionalLight position={[4, 6, 5]} intensity={1.1} color="#ffffff" />
      <directionalLight position={[-4, -2, -3]} intensity={0.45} color="#dbeafe" />

      {/* Ocean Sphere (#DCE6F5, roughness 0.85, metalness 0.02) */}
      <mesh
        geometry={oceanGeo}
        onClick={(e) => {
          e.stopPropagation();
          onSelectMarker(null);
        }}
      >
        <meshStandardMaterial
          color="#DCE6F5"
          roughness={0.85}
          metalness={0.02}
        />
      </mesh>

      {/* Thin Back-Side Atmosphere Rim (scale 1.015, #BCD0F0 at 25% opacity) */}
      <mesh geometry={rimGeo}>
        <meshBasicMaterial
          color="#BCD0F0"
          transparent
          opacity={0.25}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Subtle 30-degree Latitude/Longitude Grid (#C8D5EA at 35% opacity) */}
      <lineSegments geometry={graticuleGeo}>
        <lineBasicMaterial color="#C8D5EA" transparent opacity={0.35} />
      </lineSegments>

      {/* Dotted Continents (1 InstancedMesh draw call) */}
      <DottedContinents />

      {/* 4 Hub-and-Spoke Connection Arcs with Bouncing Packets */}
      <ConnectionArcs3D reducedMotion={reducedMotion} />

      {/* 6 Country Markers + Expanding Rings */}
      <CountryMarkers3D
        selectedId={selectedMarker?.id || null}
        onSelectMarker={(m) => onSelectMarker(m)}
        reducedMotion={reducedMotion}
      />
    </group>
  );
};

// Default camera orientation centered between Germany (51.2N, 10.4E) and India (20.6N, 78.9E)
const DEFAULT_LAT = 34;
const DEFAULT_LON = 38;
const DEFAULT_PHI = (90 - DEFAULT_LAT) * (Math.PI / 180);
const DEFAULT_THETA = (DEFAULT_LON + 180) * (Math.PI / 180);

export const ThreatGlobe: React.FC<ThreatGlobeProps> = ({
  onInspectGraph,
}) => {
  const [selectedMarker, setSelectedMarker] = useState<GlobeMarker | null>(null);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const labelElsRef = useRef<Record<string, HTMLButtonElement | null>>({});

  const isHoveringRef = useRef<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const pointerDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerPrevPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastInteractionTimeRef = useRef<number>(0);
  const introDoneRef = useRef<boolean>(false);

  const sphericalTargetRef = useRef({
    theta: DEFAULT_THETA,
    phi: DEFAULT_PHI,
    radius: 1.7,
  });
  const sphericalCurrentRef = useRef({
    theta: DEFAULT_THETA,
    phi: DEFAULT_PHI,
    radius: 1.7,
  });

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) setWebglSupported(false);
    } catch {
      setWebglSupported(false);
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onMq = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onMq);

    const io = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.05 }
    );
    if (containerRef.current) io.observe(containerRef.current);

    return () => {
      mq.removeEventListener('change', onMq);
      io.disconnect();
    };
  }, []);

  // Wheel zoom listener (minDistance 1.5, maxDistance 4.5)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      introDoneRef.current = true;
      lastInteractionTimeRef.current = performance.now();
      sphericalTargetRef.current.radius = Math.max(
        1.5,
        Math.min(4.5, sphericalTargetRef.current.radius + e.deltaY * 0.0018)
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const focusCountry = useCallback((marker: GlobeMarker | null) => {
    introDoneRef.current = true;
    lastInteractionTimeRef.current = performance.now();
    setSelectedMarker(marker);
    if (marker) {
      const phi = (90 - marker.lat) * (Math.PI / 180);
      const theta = (marker.lon + 180) * (Math.PI / 180);
      sphericalTargetRef.current.phi = Math.max(0.4, Math.min(Math.PI - 0.4, phi));
      sphericalTargetRef.current.theta = theta;
      sphericalTargetRef.current.radius = Math.min(sphericalTargetRef.current.radius, 2.55);
    }
  }, []);

  const handleResetView = useCallback(() => {
    introDoneRef.current = true;
    lastInteractionTimeRef.current = performance.now();
    setSelectedMarker(null);
    sphericalTargetRef.current.theta = DEFAULT_THETA;
    sphericalTargetRef.current.phi = DEFAULT_PHI;
    sphericalTargetRef.current.radius = 3.2;
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    introDoneRef.current = true;
    lastInteractionTimeRef.current = performance.now();
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    pointerPrevPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - pointerPrevPosRef.current.x;
    const dy = e.clientY - pointerPrevPosRef.current.y;
    pointerPrevPosRef.current = { x: e.clientX, y: e.clientY };
    lastInteractionTimeRef.current = performance.now();

    sphericalTargetRef.current.theta += dx * 0.0065;
    sphericalTargetRef.current.phi = Math.max(
      0.35,
      Math.min(Math.PI - 0.35, sphericalTargetRef.current.phi - dy * 0.0065)
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    lastInteractionTimeRef.current = performance.now();
    const movedDist = Math.hypot(
      e.clientX - pointerDownPosRef.current.x,
      e.clientY - pointerDownPosRef.current.y
    );
    // Clicking empty space without dragging clears selection
    if (movedDist < 4 && (e.target as HTMLElement).tagName === 'CANVAS') {
      // Handled by sphere/marker click
    }
  };

  return (
    <div
      ref={containerRef}
      className="cf-card p-5 flex flex-col justify-between min-w-0"
    >
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#2563EB] shrink-0" />
            <h2 className="text-base font-bold text-[#0F1B33] tracking-tight">
              Where the attack came from
            </h2>
          </div>
          <p className="text-[13px] text-[#5B6B85] mt-0.5">
            Drag to rotate · Scroll to zoom · Click a marker for details
          </p>
        </div>

        {/* Legend for the 3 marker colors */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-[#5B6B85]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
            <span>Control server</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
            <span>Where it started</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#64748B]" />
            <span>Linked countries</span>
          </span>
        </div>
      </div>

      {/* Light Sky-Slate 3D Globe Stage (#F6F8FC -> #EAF0FA, height ~520px, 20px radius) */}
      <div
        ref={viewportRef}
        onPointerEnter={() => {
          isHoveringRef.current = true;
        }}
        onPointerLeave={() => {
          isHoveringRef.current = false;
          isDraggingRef.current = false;
          lastInteractionTimeRef.current = performance.now();
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative w-full h-[520px] rounded-[20px] overflow-hidden border border-[#E2E8F1] select-none cursor-grab active:cursor-grabbing"
        style={{
          background: 'linear-gradient(180deg, #F6F8FC 0%, #EAF0FA 100%)',
        }}
      >
        {webglSupported ? (
          <Canvas
            camera={{ position: [0, 0, 1.7], fov: 38 }}
            dpr={[1, 1.75]}
            frameloop={isVisible ? 'always' : 'never'}
            gl={{ antialias: true, alpha: true }}
            onPointerMissed={() => handleResetView()}
            className="w-full h-full"
          >
            <GlobeScene
              selectedMarker={selectedMarker}
              onSelectMarker={focusCountry}
              labelElsRef={labelElsRef}
              isHoveringRef={isHoveringRef}
              isDraggingRef={isDraggingRef}
              lastInteractionTimeRef={lastInteractionTimeRef}
              sphericalTargetRef={sphericalTargetRef}
              sphericalCurrentRef={sphericalCurrentRef}
              introDoneRef={introDoneRef}
              reducedMotion={reducedMotion}
            />
          </Canvas>
        ) : (
          /* Fallback if WebGL is unavailable */
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
            <p className="text-sm font-semibold text-[#0F1B33] mb-3">
              Select a country below to inspect its role in the case:
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {GLOBE_MARKERS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMarker(m)}
                  className="px-3 py-1.5 rounded-full bg-white border border-[#E2E8F1] text-xs font-medium text-[#0F1B33] hover:border-[#2563EB] cursor-pointer"
                >
                  {m.country} · {m.count}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 6 Projected 2D HTML Pill Labels (auto-hidden when behind globe) */}
        {webglSupported && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {GLOBE_MARKERS.map((m) => {
              const isSelected = selectedMarker?.id === m.id;
              return (
                <button
                  key={m.id}
                  ref={(el) => {
                    labelElsRef.current[m.id] = el;
                  }}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    focusCountry(m);
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    opacity: 0,
                    transition: 'opacity 120ms linear',
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm border cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#2563EB] text-white border-[#1D4ED8]'
                      : 'bg-white/95 text-[#0F1B33] border-[#CBD5E1] hover:border-[#2563EB]'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: isSelected ? '#FFFFFF' : m.color,
                    }}
                  />
                  <span>{m.country}</span>
                  <span
                    className={`tabular-nums ${
                      isSelected ? 'text-blue-100' : 'text-[#5B6B85]'
                    }`}
                  >
                    · {m.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Single "Reset view" button in the top-right of the globe */}
        <button
          type="button"
          onClick={handleResetView}
          className="absolute top-3.5 right-3.5 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white border border-[#E2E8F1] text-xs font-medium text-[#0F1B33] shadow-sm transition cursor-pointer"
          title="Reset globe view"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#5B6B85]" />
          <span>Reset view</span>
        </button>

        {/* Clean White Side Card inside the Globe Card when a Country Marker is Clicked */}
        {selectedMarker && (
          <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-[320px] z-20 bg-white rounded-2xl border border-[#E2E8F1] p-4 shadow-lg space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: selectedMarker.color }}
                  />
                  <h3 className="text-sm font-bold text-[#0F1B33] truncate">
                    {selectedMarker.country}
                  </h3>
                  <span className="text-xs font-medium text-[#5B6B85] tabular-nums">
                    · {selectedMarker.count} events
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#2563EB] mt-0.5">
                  {selectedMarker.role}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMarker(null)}
                className="p-1 rounded-lg text-[#5B6B85] hover:text-[#0F1B33] hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close country details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-[#F6F8FC] border border-[#E2E8F1] flex items-center justify-between gap-2">
              <span className="text-xs text-[#5B6B85]">Key address</span>
              <span className="font-mono text-xs font-semibold text-[#0F1B33] truncate">
                {selectedMarker.keyAddress}
              </span>
            </div>

            <p className="text-[13px] text-[#5B6B85] leading-relaxed">
              {selectedMarker.whatHappened}
            </p>

            <button
              type="button"
              onClick={onInspectGraph}
              className="w-full py-2 px-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <span>See in connection graph</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreatGlobe;
