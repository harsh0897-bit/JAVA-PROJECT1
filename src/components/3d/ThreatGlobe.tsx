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
  className?: string;
  style?: React.CSSProperties;
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
 * Procedural fallback: sample ~11,000 land dot positions from world-atlas
 */
interface LandDotSample {
  pos: THREE.Vector3;
  normal: THREE.Vector3;
}

let cachedLandDots: LandDotSample[] | null = null;
let cachedLandMask: Uint8ClampedArray | null = null;

export function checkIsLand(lat: number, lon: number): boolean {
  if (!cachedLandMask) {
    getLandDotSamples();
  }
  if (!cachedLandMask) return false;
  const W = 720;
  const H = 360;
  const x = Math.min(W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * W)));
  const y = Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H)));
  const idx = (y * W + x) * 4;
  return cachedLandMask[idx] > 128;
}

export function vec3ToLatLon(v: THREE.Vector3): { lat: number; lon: number } {
  const norm = v.clone().normalize();
  const lat = Math.asin(Math.max(-1, Math.min(1, norm.y))) * (180 / Math.PI);
  let lon = Math.atan2(norm.z, -norm.x) * (180 / Math.PI) - 180;
  while (lon < -180) lon += 360;
  while (lon > 180) lon -= 360;
  return { lat, lon };
}

export interface GeoHoverInfo {
  isMarker: boolean;
  isLand: boolean;
  label: string;
  detail: string;
  lat: number;
  lon: number;
  markerColor?: string;
}

export function resolveGeoLocation(lat: number, lon: number): GeoHoverInfo {
  // 1. Check proximity to case markers (within ~7.5 degrees)
  for (const m of GLOBE_MARKERS) {
    const dLat = Math.abs(lat - m.lat);
    let dLon = Math.abs(lon - m.lon);
    if (dLon > 180) dLon = 360 - dLon;
    const distDeg = Math.hypot(dLat, dLon * Math.cos((lat * Math.PI) / 180));
    if (distDeg < 7.5) {
      return {
        isMarker: true,
        isLand: true,
        label: m.country,
        detail: `Case: ${m.role}`,
        lat,
        lon,
        markerColor: m.color,
      };
    }
  }

  // 2. Check if over land
  const isLand = checkIsLand(lat, lon);
  if (!isLand) {
    return {
      isMarker: false,
      isLand: false,
      label: 'Open ocean',
      detail: 'International waters',
      lat,
      lon,
    };
  }

  // 3. Known geographic regions on Earth
  let region = 'Land territory';
  if (lat > 35 && lat < 72 && lon > -10 && lon < 40) region = 'Europe';
  else if (lat > 10 && lat < 75 && lon >= 40 && lon < 150) region = 'Asia';
  else if (lat > 5 && lat < 38 && lon >= 65 && lon < 95) region = 'South Asia';
  else if (lat >= -35 && lat <= 37 && lon >= -20 && lon <= 55) region = 'Africa';
  else if (lat > 15 && lat < 72 && lon >= -170 && lon <= -50) region = 'North America';
  else if (lat >= -60 && lat <= 15 && lon >= -90 && lon <= -30) region = 'South America';
  else if (lat >= -50 && lat <= 0 && lon >= 110 && lon <= 180) region = 'Oceania';
  else if (lat <= -60) region = 'Antarctica';

  return {
    isMarker: false,
    isLand: true,
    label: region,
    detail: 'Terrestrial coordinates',
    lat,
    lon,
  };
}

export function formatLatLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(1)}°${ns}, ${Math.abs(lon).toFixed(1)}°${ew}`;
}

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
  cachedLandMask = img;
  const samples: LandDotSample[] = [];

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

function buildGraticuleGeometry(): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  const r = R * 1.001;

  for (const lat of [-60, -30, 0, 30, 60]) {
    const segs = 96;
    for (let i = 0; i < segs; i++) {
      const lon1 = -180 + (i / segs) * 360;
      const lon2 = -180 + ((i + 1) / segs) * 360;
      points.push(latLonToVec3(lat, lon1, r), latLonToVec3(lat, lon2, r));
    }
  }

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
 * Instanced Dotted Continents (Procedural Fallback)
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
      const pos = normal.clone().multiplyScalar(R * 1.008);
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
 * 4 Hub-and-Spoke Connection Arcs with Traveling Packet Dot + Short Fading Tail
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
      const startVec = latLonToVec3(mFrom.lat, mFrom.lon, R * 1.008);
      const endVec = latLonToVec3(mTo.lat, mTo.lon, R * 1.008);
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
    const speed = Math.PI / 2.8;

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
          <mesh geometry={arc.lineGeo}>
            <meshBasicMaterial color="#2563EB" transparent opacity={0.4} />
          </mesh>

          <mesh
            ref={(el) => {
              packetRefs.current[idx] = el;
            }}
            geometry={dotGeo}
          >
            <meshBasicMaterial color="#38BDF8" />
          </mesh>

          <mesh
            ref={(el) => {
              tail1Refs.current[idx] = el;
            }}
            geometry={tail1Geo}
          >
            <meshBasicMaterial color="#2563EB" transparent opacity={0.6} />
          </mesh>

          <mesh
            ref={(el) => {
              tail2Refs.current[idx] = el;
            }}
            geometry={tail2Geo}
          >
            <meshBasicMaterial color="#2563EB" transparent opacity={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

interface GlobeTextures {
  day: THREE.Texture | null;
  bump: THREE.Texture | null;
  water: THREE.Texture | null;
  clouds: THREE.Texture | null;
}

/**
 * Main 3D Globe Scene with Photo-Real Earth Day Map, Bump, Water Specular, Clouds,
 * Reliable First-Frame Framing (fit distance based on FOV and aspect ratio),
 * and Damped Rotation & Label Projection.
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
  velocityRef: React.MutableRefObject<{ theta: number; phi: number }>;
  introDoneRef: React.MutableRefObject<boolean>;
  reducedMotion: boolean;
  onFirstFrameReady: () => void;
  onHoverGeo: (info: GeoHoverInfo | null) => void;
  fitDistance: number;
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
  velocityRef,
  introDoneRef,
  reducedMotion,
  onFirstFrameReady,
  onHoverGeo,
  fitDistance,
}) => {
  const { camera, size, gl } = useThree();
  const introStartRef = useRef<number | null>(null);
  const firstFrameNotifiedRef = useRef<boolean>(false);
  const cloudMeshRef = useRef<THREE.Mesh>(null);

  const [textures, setTextures] = useState<GlobeTextures>({
    day: null,
    bump: null,
    water: null,
    clouds: null,
  });

  // Asynchronous texture loading with local -> remote -> procedural fallback
  useEffect(() => {
    let active = true;
    const loader = new THREE.TextureLoader();

    const loadTexture = (
      localUrl: string,
      remoteUrl: string,
      isColor: boolean
    ): Promise<THREE.Texture | null> => {
      return new Promise((resolve) => {
        loader.load(
          localUrl,
          (tex) => {
            if (!active) {
              tex.dispose();
              resolve(null);
              return;
            }
            tex.generateMipmaps = true;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            if (isColor) {
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
            }
            resolve(tex);
          },
          undefined,
          () => {
            // Attempt remote fallback
            loader.load(
              remoteUrl,
              (remTex) => {
                if (!active) {
                  remTex.dispose();
                  resolve(null);
                  return;
                }
                remTex.generateMipmaps = true;
                remTex.minFilter = THREE.LinearMipmapLinearFilter;
                remTex.magFilter = THREE.LinearFilter;
                if (isColor) {
                  remTex.colorSpace = THREE.SRGBColorSpace;
                  remTex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
                }
                resolve(remTex);
              },
              undefined,
              () => {
                resolve(null);
              }
            );
          }
        );
      });
    };

    Promise.all([
      loadTexture(
        '/earth/earth-day.jpg',
        'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
        true
      ),
      loadTexture(
        '/earth/earth-bump.png',
        'https://unpkg.com/three-globe/example/img/earth-topology.png',
        false
      ),
      loadTexture(
        '/earth/earth-water.png',
        'https://unpkg.com/three-globe/example/img/earth-water.png',
        false
      ),
      loadTexture(
        '/earth/earth-clouds.png',
        'https://threejs.org/examples/textures/planets/earth_clouds_1024.png',
        false
      ),
    ]).then(([day, bump, water, clouds]) => {
      if (active) {
        setTextures({ day, bump, water, clouds });
      } else {
        day?.dispose();
        bump?.dispose();
        water?.dispose();
        clouds?.dispose();
      }
    });

    return () => {
      active = false;
      textures.day?.dispose();
      textures.bump?.dispose();
      textures.water?.dispose();
      textures.clouds?.dispose();
    };
  }, [gl]);

  const earthGeo = useMemo(() => new THREE.SphereGeometry(R, 64, 64), []);
  const cloudGeo = useMemo(() => new THREE.SphereGeometry(R * 1.008, 64, 64), []);
  const rimGeo = useMemo(() => new THREE.SphereGeometry(R * 1.018, 64, 64), []);
  const graticuleGeo = useMemo(() => buildGraticuleGeometry(), []);

  useEffect(() => {
    return () => {
      earthGeo.dispose();
      cloudGeo.dispose();
      rimGeo.dispose();
      graticuleGeo.dispose();
    };
  }, [earthGeo, cloudGeo, rimGeo, graticuleGeo]);

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

    if (!firstFrameNotifiedRef.current) {
      firstFrameNotifiedRef.current = true;
      onFirstFrameReady();
    }

    // Slowly rotate clouds independently of earth
    if (cloudMeshRef.current && !reducedMotion) {
      cloudMeshRef.current.rotation.y += delta * 0.008;
    }

    // 1. Framing & Intro: Never start cropped. Intro starts at 1.08*fit and eases into fit over 2.0s
    const introElapsed = now - introStartRef.current;
    if (!introDoneRef.current) {
      if (reducedMotion || introElapsed >= 2.0) {
        introDoneRef.current = true;
        sphericalTargetRef.current.radius = fitDistance;
        sphericalCurrentRef.current.radius = fitDistance;
      } else {
        const u = easeInOutCubic(Math.min(1, introElapsed / 2.0));
        const r = THREE.MathUtils.lerp(fitDistance * 1.08, fitDistance, u);
        sphericalTargetRef.current.radius = r;
        sphericalCurrentRef.current.radius = r;
      }
    } else {
      // 2. Slow auto-rotation or inertia decay
      if (!isDraggingRef.current) {
        if (Math.abs(velocityRef.current.theta) > 0.00003 || Math.abs(velocityRef.current.phi) > 0.00003) {
          sphericalTargetRef.current.theta += velocityRef.current.theta;
          sphericalTargetRef.current.phi = Math.max(
            0.42,
            Math.min(Math.PI - 0.42, sphericalTargetRef.current.phi + velocityRef.current.phi)
          );
          velocityRef.current.theta *= 0.90;
          velocityRef.current.phi *= 0.90;
        } else {
          const timeSinceInteract = performance.now() - lastInteractionTimeRef.current;
          if (
            !reducedMotion &&
            !isHoveringRef.current &&
            !selectedMarker &&
            timeSinceInteract > 3000
          ) {
            sphericalTargetRef.current.theta += delta * 0.07;
          }
        }
      }
    }

    // Clamp polar angle phi and zoom radius relative to fit distance
    sphericalTargetRef.current.phi = Math.max(
      0.42,
      Math.min(Math.PI - 0.42, sphericalTargetRef.current.phi)
    );
    sphericalTargetRef.current.radius = Math.max(
      fitDistance * 0.55,
      Math.min(fitDistance * 1.50, sphericalTargetRef.current.radius)
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

    // 3. Project 6 2D HTML pill labels and hide when on rear hemisphere (dot(normal, camDir) < 0.15)
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
      {/* Daylight Illumination with realistic sun angle and subtle atmospheric blue */}
      <ambientLight intensity={0.65} color="#FFFFFF" />
      <directionalLight position={[5, 4, 3]} intensity={1.15} color="#FFFFFF" />
      <directionalLight position={[-5, -2, -3]} intensity={0.25} color="#93C5FD" />

      {/* Primary Earth Sphere with Day Map Texture */}
      <mesh
        geometry={earthGeo}
        onClick={(e) => {
          e.stopPropagation();
          onSelectMarker(null);
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (e.point) {
            const { lat, lon } = vec3ToLatLon(e.point);
            onHoverGeo(resolveGeoLocation(lat, lon));
          }
        }}
        onPointerOut={() => {
          onHoverGeo(null);
        }}
      >
        <meshStandardMaterial
          map={textures.day || undefined}
          bumpMap={textures.bump || undefined}
          bumpScale={0.024}
          roughnessMap={textures.water || undefined}
          roughness={textures.day ? 0.42 : 0.85}
          metalness={0.05}
          color={textures.day ? '#FFFFFF' : '#DCE6F5'}
        />
      </mesh>

      {/* Cloud Layer (Moving slowly, transparent without bleaching) */}
      {textures.clouds && (
        <mesh ref={cloudMeshRef} geometry={cloudGeo}>
          <meshStandardMaterial
            map={textures.clouds}
            transparent
            opacity={0.15}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Soft Blue Atmospheric Rim */}
      <mesh geometry={rimGeo}>
        <meshBasicMaterial
          color="#93C5FD"
          transparent
          opacity={0.22}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Subtle Graticule (faint latitude/longitude overlay) */}
      <lineSegments geometry={graticuleGeo}>
        <lineBasicMaterial
          color="#94A3B8"
          transparent
          opacity={textures.day ? 0.12 : 0.35}
        />
      </lineSegments>

      {/* Procedural Dotted Continents active as fallback if day texture fails to load */}
      {!textures.day && <DottedContinents />}

      {/* 4 Hub-and-Spoke Connection Arcs with Traveling Packets */}
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
  className = '',
  style,
}) => {
  const [selectedMarker, setSelectedMarker] = useState<GlobeMarker | null>(null);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [stageReady, setStageReady] = useState<boolean>(false);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [canvasReady, setCanvasReady] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const labelElsRef = useRef<Record<string, HTMLButtonElement | null>>({});

  const isHoveringRef = useRef<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const pointerDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerPrevPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const velocityRef = useRef<{ theta: number; phi: number }>({ theta: 0, phi: 0 });
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartRadiusRef = useRef<number | null>(null);
  const dragDistanceRef = useRef<number>(0);
  const lastInteractionTimeRef = useRef<number>(0);
  const introDoneRef = useRef<boolean>(false);

  const [hoverReadout, setHoverReadout] = useState<GeoHoverInfo | null>(null);
  const lastHoverUpdateRef = useRef<number>(0);

  const handleGlobeHover = useCallback((info: GeoHoverInfo | null) => {
    const now = performance.now();
    if (info === null) {
      setHoverReadout(null);
      return;
    }
    // Throttle UI state updates to ~35ms to preserve 60fps rendering
    if (now - lastHoverUpdateRef.current > 35) {
      lastHoverUpdateRef.current = now;
      setHoverReadout(info);
    }
  }, []);

  // Compute fit distance based on FOV=38 and current container aspect ratio
  const fitDistance = useMemo(() => {
    const fov = 38;
    const vFovRad = (fov * Math.PI) / 360;
    const aspect =
      containerSize.width > 0 && containerSize.height > 0
        ? containerSize.width / containerSize.height
        : 1.5;
    const hFovRad = Math.atan(Math.tan(vFovRad) * aspect);
    const R_FIT = 1.08;
    const MARGIN = 1.14;
    const distV = (R_FIT * MARGIN) / Math.sin(vFovRad);
    const distH = (R_FIT * MARGIN) / Math.sin(hFovRad);
    return Math.max(distV, distH);
  }, [containerSize.width, containerSize.height]);

  const sphericalTargetRef = useRef({
    theta: DEFAULT_THETA,
    phi: DEFAULT_PHI,
    radius: 3.6,
  });
  const sphericalCurrentRef = useRef({
    theta: DEFAULT_THETA,
    phi: DEFAULT_PHI,
    radius: 3.6,
  });

  // Keep camera distance proportional on container resize without restarting intro
  const prevFitRef = useRef<number>(fitDistance);
  useEffect(() => {
    if (prevFitRef.current !== fitDistance && prevFitRef.current > 0) {
      const ratio = fitDistance / prevFitRef.current;
      sphericalTargetRef.current.radius *= ratio;
      sphericalCurrentRef.current.radius *= ratio;
      prevFitRef.current = fitDistance;
    }
  }, [fitDistance]);

  // Stage-readiness observer: wait for .stage-enter animationend (with 500ms fallback)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      setStageReady(true);
      return;
    }

    const stageEl = el.closest('.stage-enter') as HTMLElement | null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    if (!stageEl) {
      setStageReady(true);
    } else {
      const handleAnimEnd = () => {
        setStageReady(true);
      };
      stageEl.addEventListener('animationend', handleAnimEnd, { once: true });
      fallbackTimer = setTimeout(() => {
        setStageReady(true);
      }, 500);

      return () => {
        stageEl.removeEventListener('animationend', handleAnimEnd);
        if (fallbackTimer) clearTimeout(fallbackTimer);
      };
    }
  }, []);

  // WebGL support, reduced motion, viewport intersection, and ResizeObserver
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

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && viewportRef.current) {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            setContainerSize({ width: Math.round(width), height: Math.round(height) });
          }
        }
      });
      ro.observe(viewportRef.current);
    }

    return () => {
      mq.removeEventListener('change', onMq);
      io.disconnect();
      ro?.disconnect();
    };
  }, []);

  // Proportional exponential wheel zoom with boundary escape (prevents trapping page scroll)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      introDoneRef.current = true;
      lastInteractionTimeRef.current = performance.now();

      const minR = fitDistance * 0.55;
      const maxR = fitDistance * 1.50;
      const currentR = sphericalTargetRef.current.radius;

      // Allow natural document scroll when already at zoom limits
      if (e.deltaY < 0 && currentR <= minR + 0.005) {
        return;
      }
      if (e.deltaY > 0 && currentR >= maxR - 0.005) {
        return;
      }

      e.preventDefault();
      const zoomFactor = Math.exp(e.deltaY * 0.0012);
      const nextR = currentR * zoomFactor;
      sphericalTargetRef.current.radius = Math.max(minR, Math.min(maxR, nextR));
      velocityRef.current = { theta: 0, phi: 0 };
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [fitDistance]);

  const focusCountry = useCallback(
    (marker: GlobeMarker | null) => {
      // Ignore click if was a drag operation (> 5px)
      if (dragDistanceRef.current > 5) return;
      introDoneRef.current = true;
      lastInteractionTimeRef.current = performance.now();
      velocityRef.current = { theta: 0, phi: 0 };
      setSelectedMarker(marker);
      if (marker) {
        const phi = (90 - marker.lat) * (Math.PI / 180);
        const theta = (marker.lon + 180) * (Math.PI / 180);
        sphericalTargetRef.current.phi = Math.max(0.42, Math.min(Math.PI - 0.42, phi));
        sphericalTargetRef.current.theta = theta;
        sphericalTargetRef.current.radius = fitDistance * 0.78;
      }
    },
    [fitDistance]
  );

  const handleResetView = useCallback(() => {
    introDoneRef.current = true;
    lastInteractionTimeRef.current = performance.now();
    velocityRef.current = { theta: 0, phi: 0 };
    setSelectedMarker(null);
    sphericalTargetRef.current.theta = DEFAULT_THETA;
    sphericalTargetRef.current.phi = DEFAULT_PHI;
    sphericalTargetRef.current.radius = fitDistance;
  }, [fitDistance]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    introDoneRef.current = true;
    lastInteractionTimeRef.current = performance.now();
    velocityRef.current = { theta: 0, phi: 0 };

    if (activePointersRef.current.size === 1) {
      isDraggingRef.current = true;
      dragDistanceRef.current = 0;
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
      pointerPrevPosRef.current = { x: e.clientX, y: e.clientY };
    } else if (activePointersRef.current.size === 2) {
      isDraggingRef.current = false;
      const pts = Array.from(activePointersRef.current.values());
      pinchStartDistRef.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartRadiusRef.current = sphericalTargetRef.current.radius;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Touch pinch-to-zoom
    if (
      activePointersRef.current.size === 2 &&
      pinchStartDistRef.current &&
      pinchStartRadiusRef.current
    ) {
      const pts = Array.from(activePointersRef.current.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (currentDist > 8 && pinchStartDistRef.current > 8) {
        const scale = pinchStartDistRef.current / currentDist;
        const minR = fitDistance * 0.55;
        const maxR = fitDistance * 1.50;
        sphericalTargetRef.current.radius = Math.max(
          minR,
          Math.min(maxR, pinchStartRadiusRef.current * scale)
        );
        lastInteractionTimeRef.current = performance.now();
      }
      return;
    }

    if (!isDraggingRef.current) return;

    const dx = e.clientX - pointerPrevPosRef.current.x;
    const dy = e.clientY - pointerPrevPosRef.current.y;
    pointerPrevPosRef.current = { x: e.clientX, y: e.clientY };
    lastInteractionTimeRef.current = performance.now();

    dragDistanceRef.current += Math.hypot(dx, dy);

    // Direct cursor tracking:
    // Dragging right (dx > 0) turns the front globe surface right (so theta decreases).
    // Dragging down (dy > 0) tilts the north pole down towards user (so phi decreases).
    // Scale sensitivity by current zoom distance for consistent pixel-to-surface velocity
    const currentDist = sphericalCurrentRef.current.radius;
    const zoomRatio = currentDist / fitDistance;
    const sensitivity = 0.0052 * Math.max(0.6, Math.min(1.35, zoomRatio));

    const dTheta = -dx * sensitivity;
    const dPhi = -dy * sensitivity;

    sphericalTargetRef.current.theta += dTheta;
    sphericalTargetRef.current.phi = Math.max(
      0.42,
      Math.min(Math.PI - 0.42, sphericalTargetRef.current.phi + dPhi)
    );

    // Record velocity for release inertia (decay applied in GlobeScene useFrame)
    velocityRef.current.theta = dTheta * 0.65;
    velocityRef.current.phi = dPhi * 0.65;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // Ignore capture release error
    }

    if (activePointersRef.current.size === 0) {
      isDraggingRef.current = false;
      pinchStartDistRef.current = null;
      pinchStartRadiusRef.current = null;
      lastInteractionTimeRef.current = performance.now();
    } else if (activePointersRef.current.size === 1) {
      // Single pointer remaining after pinch: re-anchor to avoid jump
      const remaining = activePointersRef.current.values().next().value;
      if (remaining) {
        pointerPrevPosRef.current = { x: remaining.x, y: remaining.y };
        isDraggingRef.current = true;
      }
    }
  };

  const isReady = stageReady && containerSize.width > 0 && containerSize.height > 0 && isVisible;

  return (
    <div
      ref={containerRef}
      className={`cf-card p-5 flex flex-col justify-between min-w-0 ${className}`.trim()}
      style={style}
    >
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 shrink-0">
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

      {/* 3D Globe Stage with touch-action pan-y, porcelain skeleton, and Canvas */}
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
        onPointerCancel={handlePointerUp}
        style={{
          touchAction: 'pan-y',
          background: 'linear-gradient(180deg, #F8FAFD 0%, #EBF1FA 100%)',
        }}
        className="relative w-full flex-1 min-h-[380px] rounded-[20px] overflow-hidden border border-[#E2E8F1] select-none cursor-grab active:cursor-grabbing"
      >
        {/* Porcelain skeleton shown while mounting and sizing */}
        {(!isReady || !canvasReady) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-300">
            <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-full bg-white/70 border border-slate-200/80 shadow-[0_8px_32px_-8px_rgba(37,99,235,0.12)] flex items-center justify-center">
              <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-full border border-dashed border-blue-200/70 animate-spin [animation-duration:18s]" />
              <div className="absolute w-2.5 h-2.5 rounded-full bg-blue-500/40 animate-ping" />
            </div>
            <span className="text-xs font-medium text-slate-400 mt-4 tracking-wide">
              Loading satellite globe telemetry…
            </span>
          </div>
        )}

        {isReady && webglSupported && (
          <div
            className="w-full h-full transition-opacity duration-350"
            style={{ opacity: canvasReady ? 1 : 0 }}
          >
            <Canvas
              camera={{ position: [0, 0, fitDistance * 1.08], fov: 38 }}
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
                velocityRef={velocityRef}
                introDoneRef={introDoneRef}
                reducedMotion={reducedMotion}
                onFirstFrameReady={() => setCanvasReady(true)}
                onHoverGeo={handleGlobeHover}
                fitDistance={fitDistance}
              />
            </Canvas>
          </div>
        )}

        {!webglSupported && (
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

        {/* Live Geographic Hover Readout Pill */}
        <div className="absolute top-3.5 left-3.5 z-10 pointer-events-none transition-all duration-150">
          {hoverReadout ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/92 backdrop-blur-md border border-[#E2E8F1] shadow-sm text-xs font-medium text-[#0F1B33]">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    hoverReadout.markerColor || (hoverReadout.isLand ? '#10B981' : '#0EA5E9'),
                }}
              />
              <span className="font-semibold text-[#0F1B33]">{hoverReadout.label}</span>
              <span className="font-mono text-[11px] text-[#5B6B85] tabular-nums">
                {formatLatLon(hoverReadout.lat, hoverReadout.lon)}
              </span>
              <span className="hidden md:inline text-[11px] text-[#64748B] border-l border-slate-200 pl-2">
                {hoverReadout.detail}
              </span>
            </div>
          ) : (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/75 backdrop-blur-sm border border-[#E2E8F1]/80 text-[11px] text-[#64748B]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]/60" />
              <span>Hover earth for live telemetry</span>
            </div>
          )}
        </div>

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
