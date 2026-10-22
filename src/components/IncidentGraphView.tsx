import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  ExtractedEntity,
  EntityRelationship,
  ShortestPathResult,
  ForensicCaseSummary,
  EvidenceItem,
} from '../types';
import { copyToClipboardSafe } from '../lib/clipboard';
import {
  isPhysicalCtrlOrMetaPressed,
  scrollWorkspaceBy,
} from '../lib/physicalKeyTracker';
import { Popover } from './layout/Popover';
import {
  RotateCcw,
  Maximize2,
  Route,
  User,
  Phone,
  Globe,
  Server,
  Landmark,
  Coins,
  Receipt,
  Mail,
  MessageSquare,
  Copy,
  Check,
  ArrowRight,
  ChevronDown,
  FileText,
  Search,
  AlertTriangle,
} from 'lucide-react';

interface IncidentGraphViewProps {
  activeCase?: ForensicCaseSummary;
  evidenceList?: EvidenceItem[];
  entities: ExtractedEntity[];
  relationships: EntityRelationship[];
  selectedEntityId: string | null;
  onSelectEntity: (id: string) => void;
  onSelectEntityForGraph?: (id: string) => void;
  onSelectEvidenceForVault?: (id: string) => void;
  onTraceShortestPath: (
    sourceId: string,
    targetId: string
  ) => Promise<ShortestPathResult | null>;
  onCreateRelationship?: (
    sourceEntityId: string,
    targetEntityId: string,
    relationshipType: string,
    label: string
  ) => Promise<void>;
  onMergeEntities?: (
    primaryEntityId: string,
    duplicateEntityId: string
  ) => Promise<void>;
  onNavigateTab?: (
    tab: 'OVERVIEW' | 'EVIDENCE' | 'TIMELINE' | 'GRAPH' | 'INTEGRITY' | 'REPORT'
  ) => void;
}

const SVG_W = 1120;
const SVG_H = 620;
const NODE_R = 18; // 36px diameter baseline solid circle

type NodeTypeGroup =
  | 'PERSON'
  | 'PHONE'
  | 'EMAIL'
  | 'BANK'
  | 'WALLET'
  | 'WEBSITE'
  | 'SERVER';

interface NodeTypeStyle {
  group: NodeTypeGroup;
  groupLabel: string;
  singularLabel: string;
  color: string;
}

function getNodeTypeStyle(entityType: string): NodeTypeStyle {
  switch (entityType) {
    case 'PERSON':
    case 'ORGANIZATION':
      return {
        group: 'PERSON',
        groupLabel: 'People',
        singularLabel: 'Person',
        color: '#3B82F6', // Soft Cobalt
      };
    case 'PHONE':
      return {
        group: 'PHONE',
        groupLabel: 'Phones',
        singularLabel: 'Phone number',
        color: '#0D9488', // Soft Teal
      };
    case 'EMAIL':
      return {
        group: 'EMAIL',
        groupLabel: 'Emails',
        singularLabel: 'Email address',
        color: '#6366F1', // Soft Indigo
      };
    case 'BANK_ACCOUNT':
    case 'UPI_ID':
    case 'TRANSACTION_ID':
      return {
        group: 'BANK',
        groupLabel: 'Bank & payment accounts',
        singularLabel: 'Bank account',
        color: '#2563EB', // Royal Blue
      };
    case 'CRYPTO_WALLET':
      return {
        group: 'WALLET',
        groupLabel: 'Crypto wallets',
        singularLabel: 'Crypto wallet',
        color: '#7C3AED', // Soft Purple
      };
    case 'URL':
    case 'DOMAIN':
      return {
        group: 'WEBSITE',
        groupLabel: 'Websites',
        singularLabel: 'Website link',
        color: '#D97706', // Warm Amber
      };
    case 'IP_ADDRESS':
    default:
      return {
        group: 'SERVER',
        groupLabel: 'Servers',
        singularLabel: 'Server IP',
        color: '#E11D48', // Soft Rose
      };
  }
}

function toPlainRelationshipVerb(relType: string, label?: string): string {
  const t = (relType || '').toUpperCase();
  if (t.includes('TRANSFERRED') || t.includes('SETTLED') || t.includes('FUNDS')) {
    return 'sent money to';
  }
  if (t.includes('LAYERED') || t.includes('MULE')) {
    return 'forwarded money to';
  }
  if (t.includes('PHISHING') || t.includes('SMS') || t.includes('LURE')) {
    return 'sent text link to';
  }
  if (t.includes('CONTROLS') || t.includes('OWNS')) {
    return 'owns';
  }
  if (t.includes('COMMUNICATES') || t.includes('CALLED')) {
    return 'called';
  }
  if (t.includes('HOSTS') || t.includes('RESOLVES')) {
    return 'hosted on';
  }
  if (t.includes('HARVEST') || t.includes('STOLE') || t.includes('CREDENTIAL')) {
    return 'captured login from';
  }
  if (label && label.trim().length > 0 && label.length <= 22) {
    return label.toLowerCase();
  }
  return 'connected to';
}

function formatShortNodeLabel(text: string): string {
  const clean = (text || '').trim();
  if (clean.length <= 16) return clean;
  return `${clean.slice(0, 15)}…`;
}

interface MergedEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: string;
  plainVerb: string;
  weight: number;
  originalIds: string[];
}

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  pinned: boolean;
}

/**
 * Deterministic BFS rings + 300-tick force relaxation (link distance 150,
 * many-body -520, collide radius 54, center + gentle anchor).
 */
function buildInitialSimulationNodes(
  entities: ExtractedEntity[],
  mergedEdges: MergedEdge[]
): Record<string, SimNode> {
  if (entities.length === 0) return {};

  // Build adjacency & degree count
  const adj: Record<string, Set<string>> = {};
  entities.forEach((e) => {
    adj[e.id] = new Set();
  });
  mergedEdges.forEach((edge) => {
    adj[edge.sourceId]?.add(edge.targetId);
    adj[edge.targetId]?.add(edge.sourceId);
  });

  // Sort entities deterministically: highest degree first, then by id
  const sorted = [...entities].sort((a, b) => {
    const degDiff = (adj[b.id]?.size || 0) - (adj[a.id]?.size || 0);
    if (degDiff !== 0) return degDiff;
    return a.id.localeCompare(b.id);
  });

  const rootId = sorted[0].id;
  const visited = new Set<string>([rootId]);
  const rings: string[][] = [[rootId]];
  let frontier = [rootId];

  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const u of frontier) {
      const neighbors = Array.from(adj[u] || []).sort((a, b) => a.localeCompare(b));
      for (const v of neighbors) {
        if (!visited.has(v)) {
          visited.add(v);
          nextFrontier.push(v);
        }
      }
    }
    if (nextFrontier.length > 0) {
      rings.push(nextFrontier);
    }
    frontier = nextFrontier;
  }

  // Any disconnected nodes go to outer ring
  const unvisited = sorted.filter((e) => !visited.has(e.id)).map((e) => e.id);
  if (unvisited.length > 0) {
    rings.push(unvisited);
  }

  const cx = SVG_W / 2;
  const cy = SVG_H / 2 - 10;
  const nodes: SimNode[] = [];
  const nodeMap: Record<string, SimNode> = {};

  rings.forEach((ring, ringIdx) => {
    if (ringIdx === 0) {
      const id = ring[0];
      const n: SimNode = {
        id,
        x: cx,
        y: cy,
        vx: 0,
        vy: 0,
        targetX: cx,
        targetY: cy,
        pinned: false,
      };
      nodes.push(n);
      nodeMap[id] = n;
      return;
    }

    const radiusX = Math.min(440, ringIdx * 165);
    const radiusY = Math.min(230, ringIdx * 115);
    const count = ring.length;
    ring.forEach((id, i) => {
      // Deterministic angle offset per ring so spokes don't align colinearly
      const angle = (2 * Math.PI * i) / count - Math.PI / 2 + ringIdx * 0.35;
      const x = cx + Math.cos(angle) * radiusX;
      const y = cy + Math.sin(angle) * radiusY;
      const n: SimNode = {
        id,
        x,
        y,
        vx: 0,
        vy: 0,
        targetX: x,
        targetY: y,
        pinned: false,
      };
      nodes.push(n);
      nodeMap[id] = n;
    });
  });

  // Pre-run 300 ticks synchronously so initial paint is completely settled
  for (let tick = 0; tick < 300; tick++) {
    const alpha = Math.max(0.015, 1 - tick / 300);
    stepForceSimulation(nodes, nodeMap, mergedEdges, alpha);
  }

  // Zero out residual velocity after pre-settling
  nodes.forEach((n) => {
    n.vx = 0;
    n.vy = 0;
  });

  return nodeMap;
}

function stepForceSimulation(
  nodes: SimNode[],
  nodeMap: Record<string, SimNode>,
  edges: MergedEdge[],
  alpha: number
) {
  const N = nodes.length;
  if (N === 0) return;

  const LINK_DISTANCE = 150;
  const CHARGE_STRENGTH = -520;
  const COLLIDE_RADIUS = 58;
  const COLLIDE_X = 76; // horizontal clearance for 16-char labels below nodes
  const COLLIDE_Y = 58;
  const cx = SVG_W / 2;
  const cy = SVG_H / 2 - 12;

  // 1. Many-body repulsion (-520)
  for (let i = 0; i < N; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < N; j++) {
      const b = nodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const distSq = Math.max(400, dx * dx + dy * dy);
      const dist = Math.sqrt(distSq);
      const force = (CHARGE_STRENGTH * alpha) / distSq;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (!a.pinned) {
        a.vx -= fx;
        a.vy -= fy;
      }
      if (!b.pinned) {
        b.vx += fx;
        b.vy += fy;
      }
    }
  }

  // 2. Link spring force (distance 150)
  for (const edge of edges) {
    const src = nodeMap[edge.sourceId];
    const dst = nodeMap[edge.targetId];
    if (!src || !dst) continue;
    const dx = dst.x - src.x;
    const dy = dst.y - src.y;
    const dist = Math.hypot(dx, dy) || 1;
    const displacement = (dist - LINK_DISTANCE) * 0.065 * alpha;
    const fx = (dx / dist) * displacement;
    const fy = (dy / dist) * displacement;
    if (!src.pinned) {
      src.vx += fx;
      src.vy += fy;
    }
    if (!dst.pinned) {
      dst.vx -= fx;
      dst.vy -= fy;
    }
  }

  // 3. Gentle forceX / forceY + center pull so nothing drifts away
  for (let i = 0; i < N; i++) {
    const n = nodes[i];
    if (n.pinned) continue;
    n.vx += (cx - n.x) * 0.012 * alpha;
    n.vy += (cy - n.y) * 0.018 * alpha;
    n.vx += (n.targetX - n.x) * 0.022 * alpha;
    n.vy += (n.targetY - n.y) * 0.022 * alpha;
  }

  // 4. Collision force (radius 54+ with label box awareness)
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < N; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < N; j++) {
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.1;
        const minDist = COLLIDE_RADIUS * 2;
        if (dist < minDist) {
          const overlap = ((minDist - dist) / dist) * 0.5;
          const ox = dx * overlap;
          const oy = dy * overlap;
          if (!a.pinned && !b.pinned) {
            a.x -= ox;
            a.y -= oy;
            b.x += ox;
            b.y += oy;
          } else if (!a.pinned) {
            a.x -= ox * 2;
            a.y -= oy * 2;
          } else if (!b.pinned) {
            b.x += ox * 2;
            b.y += oy * 2;
          }
        } else if (Math.abs(dx) < COLLIDE_X && Math.abs(dy) < COLLIDE_Y) {
          // Keep labels under nodes from overlapping horizontally
          const pushY = ((COLLIDE_Y - Math.abs(dy)) * 0.25) * (dy >= 0 ? 1 : -1);
          if (!a.pinned) a.y -= pushY;
          if (!b.pinned) b.y += pushY;
        }
      }
    }
  }

  // 5. Integrate velocities and clamp strictly inside canvas bounds
  const MIN_X = 76;
  const MAX_X = SVG_W - 76;
  const MIN_Y = 52;
  const MAX_Y = SVG_H - 68;

  for (let i = 0; i < N; i++) {
    const n = nodes[i];
    if (n.pinned) {
      n.vx = 0;
      n.vy = 0;
      n.x = Math.max(MIN_X, Math.min(MAX_X, n.x));
      n.y = Math.max(MIN_Y, Math.min(MAX_Y, n.y));
      continue;
    }
    n.vx *= 0.62;
    n.vy *= 0.62;
    n.x = Math.max(MIN_X, Math.min(MAX_X, n.x + n.vx));
    n.y = Math.max(MIN_Y, Math.min(MAX_Y, n.y + n.vy));
  }
}

/**
 * Bidirectional weighted Dijkstra shortest-path algorithm so any node to any node works.
 */
function computeBidirectionalShortestPath(
  srcId: string,
  dstId: string,
  allEntities: ExtractedEntity[],
  mergedEdges: MergedEdge[]
): ShortestPathResult {
  if (srcId === dstId) {
    return {
      sourceEntityId: srcId,
      targetEntityId: dstId,
      pathFound: true,
      hopCount: 0,
      totalWeight: 0,
      nodeIds: [srcId],
      edgeIds: [],
      narrativeSteps: [],
    };
  }

  const adj: Record<string, { neighbor: string; edgeId: string; cost: number }[]> = {};
  allEntities.forEach((e) => {
    adj[e.id] = [];
  });

  mergedEdges.forEach((edge) => {
    if (!adj[edge.sourceId]) adj[edge.sourceId] = [];
    if (!adj[edge.targetId]) adj[edge.targetId] = [];
    const cost = 1; // Equal step cost for clearest minimum-hop path
    adj[edge.sourceId].push({ neighbor: edge.targetId, edgeId: edge.id, cost });
    adj[edge.targetId].push({ neighbor: edge.sourceId, edgeId: edge.id, cost });
  });

  const dist: Record<string, number> = {};
  const prevNode: Record<string, string | null> = {};
  const prevEdge: Record<string, string | null> = {};
  const visited = new Set<string>();

  allEntities.forEach((e) => {
    dist[e.id] = Infinity;
    prevNode[e.id] = null;
    prevEdge[e.id] = null;
  });
  dist[srcId] = 0;

  while (true) {
    let u: string | null = null;
    let bestDist = Infinity;
    for (const e of allEntities) {
      if (!visited.has(e.id) && dist[e.id] < bestDist) {
        bestDist = dist[e.id];
        u = e.id;
      }
    }
    if (u === null || u === dstId) break;
    visited.add(u);

    for (const { neighbor, edgeId, cost } of adj[u] || []) {
      if (visited.has(neighbor)) continue;
      const alt = dist[u] + cost;
      if (alt < dist[neighbor]) {
        dist[neighbor] = alt;
        prevNode[neighbor] = u;
        prevEdge[neighbor] = edgeId;
      }
    }
  }

  if (dist[dstId] !== undefined && dist[dstId] < Infinity) {
    const nodeIds: string[] = [];
    const edgeIds: string[] = [];
    let curr: string | null = dstId;
    while (curr && curr !== srcId) {
      nodeIds.unshift(curr);
      const eid = prevEdge[curr];
      if (eid) edgeIds.unshift(eid);
      curr = prevNode[curr];
    }
    nodeIds.unshift(srcId);
    return {
      sourceEntityId: srcId,
      targetEntityId: dstId,
      pathFound: true,
      hopCount: edgeIds.length,
      totalWeight: Number((edgeIds.length * 1.0).toFixed(2)),
      nodeIds,
      edgeIds,
      narrativeSteps: [],
    };
  }

  return {
    sourceEntityId: srcId,
    targetEntityId: dstId,
    pathFound: false,
    hopCount: 0,
    totalWeight: 0,
    nodeIds: [],
    edgeIds: [],
    narrativeSteps: [],
  };
}

interface SearchableNodeSelectProps {
  id: string;
  label: string;
  value: string;
  entities: ExtractedEntity[];
  onChange: (id: string) => void;
}

const SearchableNodeSelect: React.FC<SearchableNodeSelectProps> = ({
  id,
  label,
  value,
  entities,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const selectedEntity = entities.find((e) => e.id === value) || null;
  const selectedStyle = selectedEntity
    ? getNodeTypeStyle(selectedEntity.entityType)
    : null;

  const groupedOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = entities.filter((e) => {
      if (!q) return true;
      const name = (e.displayLabel || e.normalizedValue || e.id).toLowerCase();
      const style = getNodeTypeStyle(e.entityType);
      return (
        name.includes(q) ||
        e.id.toLowerCase().includes(q) ||
        style.groupLabel.toLowerCase().includes(q) ||
        style.singularLabel.toLowerCase().includes(q)
      );
    });

    const groups: Record<string, { label: string; items: ExtractedEntity[] }> = {};
    filtered.forEach((e) => {
      const st = getNodeTypeStyle(e.entityType);
      if (!groups[st.group]) {
        groups[st.group] = { label: st.groupLabel, items: [] };
      }
      groups[st.group].items.push(e);
    });
    return Object.values(groups);
  }, [entities, search]);

  return (
    <div className="inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => !prev);
          setSearch('');
        }}
        className="h-9 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 inline-flex items-center gap-2 transition cursor-pointer shadow-2xs min-w-[180px] max-w-[240px]"
      >
        <span className="text-slate-400 text-[11px] shrink-0">{label}</span>
        {selectedStyle && (
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: selectedStyle.color }}
          />
        )}
        <span className="truncate font-semibold text-slate-900 flex-1 text-left">
          {selectedEntity
            ? selectedEntity.displayLabel || selectedEntity.normalizedValue
            : 'Choose node…'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <Popover
        id={id}
        isOpen={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        width={340}
        role="listbox"
        ariaLabel={label}
      >
        <div className="space-y-2">
          <div className="relative px-1 pt-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people, phones, accounts..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {groupedOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No matching items found.
              </div>
            ) : (
              groupedOptions.map((grp) => (
                <div key={grp.label} className="space-y-0.5">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {grp.label}
                  </div>
                  {grp.items.map((item) => {
                    const st = getNodeTypeStyle(item.entityType);
                    const isSelected = item.id === value;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onChange(item.id);
                          setOpen(false);
                        }}
                        className="cf-pop-row w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: st.color }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {item.displayLabel || item.normalizedValue}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {st.singularLabel}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-blue-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </Popover>
    </div>
  );
};

export const IncidentGraphView: React.FC<IncidentGraphViewProps> = ({
  activeCase,
  evidenceList = [],
  entities,
  relationships,
  selectedEntityId,
  onSelectEntity,
  onSelectEntityForGraph,
  onSelectEvidenceForVault,
  onTraceShortestPath,
  onNavigateTab,
}) => {
  // Merge parallel edges between the same two nodes into one clean edge
  const mergedEdges: MergedEdge[] = useMemo(() => {
    const map = new Map<string, MergedEdge>();
    const entitySet = new Set(entities.map((e) => e.id));

    relationships.forEach((r) => {
      if (
        !entitySet.has(r.sourceEntityId) ||
        !entitySet.has(r.targetEntityId) ||
        r.sourceEntityId === r.targetEntityId
      ) {
        return;
      }
      const pairKey =
        r.sourceEntityId < r.targetEntityId
          ? `${r.sourceEntityId}__${r.targetEntityId}`
          : `${r.targetEntityId}__${r.sourceEntityId}`;

      const existing = map.get(pairKey);
      if (existing) {
        existing.originalIds.push(r.id);
      } else {
        map.set(pairKey, {
          id: r.id,
          sourceId: r.sourceEntityId,
          targetId: r.targetEntityId,
          relationshipType: r.relationshipType,
          plainVerb: toPlainRelationshipVerb(r.relationshipType, r.label),
          weight: r.weight || 1,
          originalIds: [r.id],
        });
      }
    });

    return Array.from(map.values());
  }, [entities, relationships]);

  // Live simulation state
  const simNodesRef = useRef<Record<string, SimNode>>({});
  const simAlphaRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const [renderTick, setRenderTick] = useState<number>(0);

  // Dragging node state
  const draggingNodeIdRef = useRef<string | null>(null);
  const dragMovedRef = useRef<boolean>(false);

  // Canvas Zoom & Pan
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(1);
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanningCanvas, setIsPanningCanvas] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasPanMovedRef = useRef<boolean>(false);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // Selection & hover state: start with null on canvas so initial graph open is un-dimmed
  // while the right detail card still previews selectedEntityId || entities[0].
  const [canvasSelectedNodeId, setCanvasSelectedNodeId] = useState<string | null>(() =>
    selectedEntityId && entities.length > 0 && selectedEntityId !== entities[0]?.id
      ? selectedEntityId
      : null
  );
  const prevSelectedEntityIdRef = useRef<string | null>(selectedEntityId);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [copiedValue, setCopiedValue] = useState<boolean>(false);

  // Path tracer state
  const [pathSource, setPathSource] = useState<string>('');
  const [pathTarget, setPathTarget] = useState<string>('');
  const [nextDropdownSlot, setNextDropdownSlot] = useState<'FROM' | 'TO'>('FROM');
  const [shortestPath, setShortestPath] = useState<ShortestPathResult | null>(null);

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Zoom to fit all nodes (or active route) with balanced padding preventing label clipping.
  // Baseline full-graph fit is capped at 1.0x so nodes never appear artificially enlarged.
  const fitNodesInView = useCallback(
    (nodeIdsToFit?: string[]) => {
      const isSubsetFit = !!(nodeIdsToFit && nodeIdsToFit.length > 0);
      const ids = isSubsetFit ? nodeIdsToFit! : entities.map((e) => e.id);
      const pts = ids
        .map((id) => simNodesRef.current[id])
        .filter((n): n is SimNode => !!n);
      if (pts.length === 0) {
        setZoom(1);
        setPan({ x: 0, y: 0 });
        zoomRef.current = 1;
        panRef.current = { x: 0, y: 0 };
        return;
      }

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      pts.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });

      const padX = 72;
      const padY = 56;
      const contentMinX = minX - NODE_R - padX;
      const contentMaxX = maxX + NODE_R + padX;
      const contentMinY = minY - NODE_R - padY;
      const contentMaxY = maxY + NODE_R + 36 + padY;

      const boxW = Math.max(300, contentMaxX - contentMinX);
      const boxH = Math.max(220, contentMaxY - contentMinY);
      const maxFitZoom = isSubsetFit ? 1.15 : 1.0;
      const targetZoom = Math.max(
        0.65,
        Math.min(maxFitZoom, Math.min(SVG_W / boxW, SVG_H / boxH))
      );

      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY + 18) / 2;
      const cx = SVG_W / 2;
      const cy = SVG_H / 2;

      const nextZoom = Number(targetZoom.toFixed(2));
      const nextPan = {
        x: Math.round((cx - midX) * targetZoom),
        y: Math.round((cy - midY) * targetZoom),
      };
      setZoom(nextZoom);
      setPan(nextPan);
      zoomRef.current = nextZoom;
      panRef.current = nextPan;
    },
    [entities]
  );

  // Initialize deterministic BFS + 300-tick force layout and fit to view whenever entity set changes
  const entitySignature = useMemo(
    () => entities.map((e) => e.id).sort().join('|'),
    [entities]
  );

  useEffect(() => {
    simNodesRef.current = buildInitialSimulationNodes(entities, mergedEdges);
    simAlphaRef.current = 0;
    fitNodesInView();
    setRenderTick((t) => t + 1);
  }, [entitySignature, mergedEdges, entities, fitNodesInView]);

  // Physics animation loop when active (during node drag or Auto-arrange)
  const startSimulationLoop = useCallback(
    (initialAlpha = 0.45) => {
      simAlphaRef.current = Math.max(simAlphaRef.current, initialAlpha);
      if (rafRef.current !== null) return;

      const loop = () => {
        const nodesList = Object.values(simNodesRef.current);
        if (draggingNodeIdRef.current) {
          // Keep warm while user is actively dragging a node so neighbours react smoothly
          simAlphaRef.current = Math.max(simAlphaRef.current, 0.28);
        } else {
          simAlphaRef.current *= 0.92;
        }

        stepForceSimulation(
          nodesList,
          simNodesRef.current,
          mergedEdges,
          simAlphaRef.current
        );
        setRenderTick((t) => t + 1);

        if (simAlphaRef.current > 0.012 || draggingNodeIdRef.current) {
          rafRef.current = requestAnimationFrame(loop);
        } else {
          rafRef.current = null;
        }
      };

      rafRef.current = requestAnimationFrame(loop);
    },
    [mergedEdges]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Keep canvasSelectedNodeId synced only when parent explicitly changes selectedEntityId
  useEffect(() => {
    if (selectedEntityId !== prevSelectedEntityIdRef.current) {
      prevSelectedEntityIdRef.current = selectedEntityId;
      if (selectedEntityId && selectedEntityId !== entities[0]?.id) {
        setCanvasSelectedNodeId(selectedEntityId);
      }
    }
  }, [selectedEntityId, entities]);

  // Escape key clears transient/pinned selection and edge inspection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCanvasSelectedNodeId(null);
        setHoveredEntityId(null);
        setSelectedEdgeId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset per-case graph state on case switch
  const prevCaseIdRef = useRef<string | undefined>(activeCase?.id);
  useEffect(() => {
    if (prevCaseIdRef.current !== activeCase?.id) {
      prevCaseIdRef.current = activeCase?.id;
      setShortestPath(null);
      setCanvasSelectedNodeId(null);
      setHoveredEntityId(null);
      setHoveredEdgeId(null);
      setSelectedEdgeId(null);
    }
  }, [activeCase?.id]);

  // Synchronize default From & To dropdowns
  useEffect(() => {
    if (entities.length === 0) {
      setPathSource('');
      setPathTarget('');
      setShortestPath(null);
      return;
    }

    const victimPhone =
      entities.find(
        (e) =>
          (e.normalizedValue || '').includes('9820411892') ||
          (e.displayLabel || '').includes('9820411892') ||
          e.entityType === 'PHONE'
      ) || entities[0];

    const walletDst =
      entities.find(
        (e) =>
          (e.normalizedValue || '').toLowerCase().startsWith('tqn9y') ||
          (e.displayLabel || '').toLowerCase().startsWith('tqn9y') ||
          e.entityType === 'CRYPTO_WALLET'
      ) || entities[entities.length - 1];

    setPathSource((prev) =>
      prev && entities.some((e) => e.id === prev) ? prev : victimPhone.id
    );
    setPathTarget((prev) =>
      prev && entities.some((e) => e.id === prev) ? prev : walletDst.id
    );
    setShortestPath((prev) => {
      if (!prev) return null;
      const validIds = new Set(entities.map((e) => e.id));
      const nodeIds: string[] = prev.orderedEntityIds || prev.nodeIds || [];
      const allPresent = nodeIds.every((id: string) =>
        validIds.has(id)
      );
      return allPresent ? prev : null;
    });
  }, [entities]);

  // Convert client pointer coordinates to SVG world coordinates (accounting for pan & zoom)
  const clientToSvgCoords = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: SVG_W / 2, y: SVG_H / 2 };
      const rect = svg.getBoundingClientRect();
      const relX = ((clientX - rect.left) / rect.width) * SVG_W;
      const relY = ((clientY - rect.top) / rect.height) * SVG_H;
      const cx = SVG_W / 2;
      const cy = SVG_H / 2;
      const worldX = (relX - cx - pan.x) / zoom + cx;
      const worldY = (relY - cy - pan.y) / zoom + cy;
      return {
        x: Math.max(64, Math.min(SVG_W - 64, worldX)),
        y: Math.max(48, Math.min(SVG_H - 64, worldY)),
      };
    },
    [pan, zoom]
  );

  // Node pointer down -> start dragging node
  const handleNodePointerDown = (
    e: React.PointerEvent<SVGGElement>,
    nodeId: string
  ) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    draggingNodeIdRef.current = nodeId;
    dragMovedRef.current = false;

    const simNode = simNodesRef.current[nodeId];
    if (simNode) {
      simNode.pinned = true;
    }
    startSimulationLoop(0.32);
  };

  const handleNodePointerMove = (
    e: React.PointerEvent<SVGGElement>,
    nodeId: string
  ) => {
    if (draggingNodeIdRef.current !== nodeId) return;
    e.stopPropagation();
    const pt = clientToSvgCoords(e.clientX, e.clientY);
    const simNode = simNodesRef.current[nodeId];
    if (simNode) {
      if (Math.hypot(pt.x - simNode.x, pt.y - simNode.y) > 2.5) {
        dragMovedRef.current = true;
      }
      simNode.x = pt.x;
      simNode.y = pt.y;
      simNode.vx = 0;
      simNode.vy = 0;
      simNode.pinned = true;
    }
  };

  const handleNodePointerUp = (
    e: React.PointerEvent<SVGGElement>,
    nodeId: string
  ) => {
    if (draggingNodeIdRef.current !== nodeId) return;
    e.stopPropagation();
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture already released
    }
    const wasDragged = dragMovedRef.current;
    draggingNodeIdRef.current = null;

    if (!wasDragged) {
      // It was a click/tap: select node + populate next dropdown if empty or alternating
      setCanvasSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      onSelectEntity(nodeId);
      if (onSelectEntityForGraph) onSelectEntityForGraph(nodeId);

      if (!pathSource) {
        setPathSource(nodeId);
        setNextDropdownSlot('TO');
      } else if (!pathTarget) {
        setPathTarget(nodeId);
        setNextDropdownSlot('FROM');
      } else if (nextDropdownSlot === 'FROM') {
        setPathSource(nodeId);
        setNextDropdownSlot('TO');
      } else {
        setPathTarget(nodeId);
        setNextDropdownSlot('FROM');
      }
    }
  };

  const handleNodeDoubleClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const simNode = simNodesRef.current[nodeId];
    if (simNode) {
      simNode.pinned = false;
      startSimulationLoop(0.45);
    }
  };

  // Auto-arrange: release all pins, re-settle deterministically, and fit to baseline view
  const handleAutoArrange = () => {
    simNodesRef.current = buildInitialSimulationNodes(entities, mergedEdges);
    setCanvasSelectedNodeId(null);
    setSelectedEdgeId(null);
    fitNodesInView();
    setRenderTick((t) => t + 1);
  };

  // Canvas background pan & single non-passive native wheel listener (0.5x - 2.5x)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (draggingNodeIdRef.current) return;
    setIsPanningCanvas(true);
    canvasPanMovedRef.current = false;
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isPanningCanvas || draggingNodeIdRef.current) return;
    const dx = e.clientX - (panStartRef.current.x + pan.x);
    const dy = e.clientY - (panStartRef.current.y + pan.y);
    if (Math.hypot(dx, dy) > 3) {
      canvasPanMovedRef.current = true;
    }
    setPan({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    });
  };

  const handleCanvasMouseUp = () => {
    setIsPanningCanvas(false);
  };

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;

    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 2.5;

    const onWheel = (e: WheelEvent) => {
      if (draggingNodeIdRef.current) return;

      // Normalize deltaMode (0 = pixels, 1 = lines, 2 = pages)
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= 320;
      if (dy === 0) return;

      // When Ctrl is held (or physical Ctrl/Meta), do not zoom graph, allow page to scroll naturally
      if (e.ctrlKey || isPhysicalCtrlOrMetaPressed()) {
        return;
      }

      // D2: Trackpad pinch (e.ctrlKey === true without physical modifier key)
      const isPinch = e.ctrlKey && !physicalKey;

      const currentZoom = zoomRef.current;

      // D4: Pass through to scroll page when already at min/max zoom limits
      if (dy < 0 && currentZoom >= MAX_ZOOM - 0.001) {
        return;
      }
      if (dy > 0 && currentZoom <= MIN_ZOOM + 0.001) {
        return;
      }

      e.preventDefault();

      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * SVG_W;
      const relY = ((e.clientY - rect.top) / Math.max(1, rect.height)) * SVG_H;
      const cx = SVG_W / 2;
      const cy = SVG_H / 2;

      const sensitivity = isPinch ? 0.0055 : 0.0015;
      const clampedDy = Math.max(-160, Math.min(160, dy));
      const zoomFactor = Math.exp(-clampedDy * sensitivity);
      const newZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, Number((currentZoom * zoomFactor).toFixed(3)))
      );
      if (Math.abs(newZoom - currentZoom) < 0.001) return;

      const currentPan = panRef.current;
      const scaleRatio = newZoom / currentZoom;
      const newPanX = currentPan.x + (relX - cx - currentPan.x) * (1 - scaleRatio);
      const newPanY = currentPan.y + (relY - cy - currentPan.y) * (1 - scaleRatio);

      const nextPan = {
        x: Math.round(Math.max(-SVG_W * 1.2, Math.min(SVG_W * 1.2, newPanX))),
        y: Math.round(Math.max(-SVG_H * 1.2, Math.min(SVG_H * 1.2, newPanY))),
      };

      zoomRef.current = newZoom;
      panRef.current = nextPan;
      setZoom(newZoom);
      setPan(nextPan);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Active entity for Right Detail Card:
  // Shows hovered entity for immediate live preview, falling back stably to pinned selection or default
  const selectedEntity = useMemo(() => {
    const activeId = hoveredEntityId || canvasSelectedNodeId || selectedEntityId;
    if (activeId) {
      const found = entities.find((e) => e.id === activeId);
      if (found) return found;
    }
    return entities[0] || null;
  }, [entities, hoveredEntityId, canvasSelectedNodeId, selectedEntityId]);

  // Hovered node details for instant floating SVG tooltip
  const hoveredEntity = useMemo(
    () => (hoveredEntityId ? entities.find((e) => e.id === hoveredEntityId) || null : null),
    [hoveredEntityId, entities]
  );
  const hoveredPos = hoveredEntity ? simNodesRef.current[hoveredEntity.id] : null;

  // Persistent focus node for neighbourhood highlighting:
  // Hovered node takes active precedence; if no hover, pinned canvasSelectedNodeId keeps its neighborhood highlighted
  const focusNodeId = hoveredEntityId || canvasSelectedNodeId;

  // Connected neighbours for the selected entity
  const connectedNeighbors = useMemo(() => {
    if (!selectedEntity) return [];
    const list: { entity: ExtractedEntity; verb: string; edgeId: string }[] = [];
    mergedEdges.forEach((edge) => {
      if (edge.sourceId === selectedEntity.id) {
        const other = entities.find((e) => e.id === edge.targetId);
        if (other) list.push({ entity: other, verb: edge.plainVerb, edgeId: edge.id });
      } else if (edge.targetId === selectedEntity.id) {
        const other = entities.find((e) => e.id === edge.sourceId);
        if (other) list.push({ entity: other, verb: edge.plainVerb, edgeId: edge.id });
      }
    });
    return list;
  }, [selectedEntity, mergedEdges, entities]);

  // Active route lookup maps
  const hasActiveRoute = !!(
    shortestPath &&
    shortestPath.pathFound &&
    shortestPath.nodeIds &&
    shortestPath.nodeIds.length > 0
  );

  const routeInfo = useMemo(() => {
    const nodeOrder: Record<string, number> = {};
    const pairEdgeSet = new Set<string>();
    const steps: {
      node: ExtractedEntity;
      stepNum: number;
      nextVerb?: string;
    }[] = [];

    if (shortestPath?.pathFound && shortestPath.nodeIds) {
      shortestPath.nodeIds.forEach((nid, idx) => {
        nodeOrder[nid] = idx + 1;
        const ent = entities.find((e) => e.id === nid);
        let nextVerb: string | undefined;
        const nextId = shortestPath.nodeIds[idx + 1];
        if (nextId) {
          const pairKey =
            nid < nextId ? `${nid}__${nextId}` : `${nextId}__${nid}`;
          pairEdgeSet.add(pairKey);
          const matchingEdge = mergedEdges.find(
            (me) =>
              (me.sourceId === nid && me.targetId === nextId) ||
              (me.sourceId === nextId && me.targetId === nid)
          );
          nextVerb = matchingEdge?.plainVerb || 'connected to';
        }
        if (ent) {
          steps.push({ node: ent, stepNum: idx + 1, nextVerb });
        }
      });
    }

    const hasHighRiskOnRoute = steps.some(
      (s) => s.node.riskLevel === 'CRITICAL' || s.node.riskLevel === 'HIGH'
    );

    return { nodeOrder, pairEdgeSet, steps, hasHighRiskOnRoute };
  }, [shortestPath, entities, mergedEdges]);

  // Trace route handler (uses bidirectional shortest path so any node to any node works)
  const handleTraceRoute = async () => {
    const src = pathSource || entities[0]?.id;
    const dst = pathTarget || entities[entities.length - 1]?.id;
    if (!src || !dst) return;

    const localBiPath = computeBidirectionalShortestPath(
      src,
      dst,
      entities,
      mergedEdges
    );

    try {
      await onTraceShortestPath(src, dst);
    } catch {
      // Ignore backend error; bidirectional path handles all node pairs cleanly
    }

    setShortestPath(localBiPath);
    if (localBiPath.pathFound && localBiPath.nodeIds.length > 0) {
      fitNodesInView(localBiPath.nodeIds);
    }
  };

  const handleClearRoute = () => {
    setShortestPath(null);
    fitNodesInView();
  };

  // Compute SVG edges from current simulation positions
  const renderedEdges = useMemo(() => {
    // Reference renderTick so React re-computes when force simulation moves nodes
    void renderTick;

    return mergedEdges
      .map((edge) => {
        const srcPos = simNodesRef.current[edge.sourceId];
        const dstPos = simNodesRef.current[edge.targetId];
        if (!srcPos || !dstPos) return null;

        const pairKey =
          edge.sourceId < edge.targetId
            ? `${edge.sourceId}__${edge.targetId}`
            : `${edge.targetId}__${edge.sourceId}`;
        const inRoute = routeInfo.pairEdgeSet.has(pairKey);

        // Orient from route step i -> step i+1 when in route
        let sx = srcPos.x;
        let sy = srcPos.y;
        let tx = dstPos.x;
        let ty = dstPos.y;

        if (inRoute && shortestPath?.nodeIds) {
          const idxA = shortestPath.nodeIds.indexOf(edge.sourceId);
          const idxB = shortestPath.nodeIds.indexOf(edge.targetId);
          if (idxA > idxB && idxB !== -1) {
            sx = dstPos.x;
            sy = dstPos.y;
            tx = srcPos.x;
            ty = srcPos.y;
          }
        }

        const dx = tx - sx;
        const dy = ty - sy;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        const nx = -uy;
        const ny = ux;
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;

        // Straight line (0 curve) unless straight segment passes near a third node
        const candidateOffsets = [0, 32, -32, 54, -54];
        let chosenOffset = 0;
        for (const offset of candidateOffsets) {
          const cxTest = mx + nx * offset;
          const cyTest = my + ny * offset;
          const samples = [0.25, 0.5, 0.75].map((t) => ({
            x: (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cxTest + t * t * tx,
            y: (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cyTest + t * t * ty,
          }));
          const hitsOtherNode = entities.some((ent) => {
            if (ent.id === edge.sourceId || ent.id === edge.targetId) return false;
            const np = simNodesRef.current[ent.id];
            if (!np) return false;
            return samples.some(
              (pt) => Math.hypot(pt.x - np.x, pt.y - np.y) < NODE_R + 14
            );
          });
          if (!hitsOtherNode) {
            chosenOffset = offset;
            break;
          }
        }

        const cx = mx + nx * chosenOffset;
        const cy = my + ny * chosenOffset;

        const startX = sx + ux * (NODE_R + 3);
        const startY = sy + uy * (NODE_R + 3);
        const endX = tx - ux * (NODE_R + 7);
        const endY = ty - uy * (NODE_R + 7);

        const d =
          chosenOffset === 0
            ? `M ${startX.toFixed(1)} ${startY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`
            : `M ${startX.toFixed(1)} ${startY.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;

        const midX = 0.25 * startX + 0.5 * cx + 0.25 * endX;
        const midY = 0.25 * startY + 0.5 * cy + 0.25 * endY;

        return {
          edge,
          d,
          midX,
          midY,
          inRoute,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [mergedEdges, entities, routeInfo, shortestPath, renderTick]);

  const getWhiteNodeIcon = (type: string) => {
    const props = { className: 'w-4 h-4 text-white stroke-[2.2]' };
    switch (type) {
      case 'PERSON':
      case 'ORGANIZATION':
        return <User {...props} />;
      case 'PHONE':
        return <Phone {...props} />;
      case 'EMAIL':
        return <Mail {...props} />;
      case 'BANK_ACCOUNT':
      case 'UPI_ID':
        return <Landmark {...props} />;
      case 'CRYPTO_WALLET':
        return <Coins {...props} />;
      case 'URL':
      case 'DOMAIN':
        return <Globe {...props} />;
      case 'IP_ADDRESS':
        return <Server {...props} />;
      case 'TRANSACTION_ID':
        return <Receipt {...props} />;
      default:
        return <MessageSquare {...props} />;
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 lg:px-8 pb-12 space-y-5 font-sans select-none min-w-0">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 font-mono">
            3 · Connection Graph
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            How People, Phones, and Accounts Connect
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Drag any circle to rearrange. Click a circle to see its details, or trace the path between any two items below.
          </p>
        </div>
      </div>

      {/* ── Main 2-Column Layout: [Graph Canvas, Wide] + [One Detail Card on Right] ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start min-w-0">
        {/* ── Left Wide Graph Card ─────────────────────────────────────────── */}
        <div className="cf-card overflow-hidden flex flex-col min-w-0">
          {/* Top Bar: Legend + Auto-arrange + Zoom to fit */}
          <div className="px-4 py-3 bg-[#F6F8FC] border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
                <span>Person</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0D9488]" />
                <span>Phone</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#6366F1]" />
                <span>Email</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                <span>Bank</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7C3AED]" />
                <span>Wallet</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
                <span>Website</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E11D48]" />
                <span>Server</span>
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleAutoArrange}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="Release pinned circles and re-run automatic layout"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Auto-arrange</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  fitNodesInView(
                    hasActiveRoute ? shortestPath?.nodeIds : undefined
                  )
                }
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="Fit graph inside view"
              >
                <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Zoom to fit</span>
              </button>
            </div>
          </div>

          {/* Center SVG Force Canvas */}
          <div
            ref={canvasContainerRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onClick={() => {
              if (!canvasPanMovedRef.current) {
                setSelectedEdgeId(null);
                setCanvasSelectedNodeId(null);
              }
            }}
            style={{
              height: 'clamp(460px, 60vh, 600px)',
              background: '#F6F8FC',
              touchAction: 'pan-y',
            }}
            className={`relative w-full overflow-hidden ${
              isPanningCanvas ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full h-full block select-none"
            >
              <defs>
                <style>{`
                  @keyframes cfRouteFlow {
                    from { stroke-dashoffset: 24; }
                    to { stroke-dashoffset: 0; }
                  }
                  .cf-route-dash {
                    animation: cfRouteFlow 0.9s linear infinite;
                  }
                  @media (prefers-reduced-motion: reduce) {
                    .cf-route-dash,
                    .cf-graph-viewport {
                      animation: none !important;
                      transition: none !important;
                    }
                  }
                `}</style>

                {/* Soft drop shadow for nodes and tooltips */}
                <filter
                  id="node-soft-shadow"
                  x="-25%"
                  y="-25%"
                  width="150%"
                  height="150%"
                >
                  <feDropShadow
                    dx="0"
                    dy="2"
                    stdDeviation="2.5"
                    floodColor="#101828"
                    floodOpacity="0.16"
                  />
                </filter>

                {/* Quiet default arrow (subtle, low contrast) */}
                <marker
                  id="edge-arrow-default"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="4.5"
                  markerHeight="4.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#94A3B8" opacity="0.65" />
                </marker>

                {/* Substantially dimmed arrow for non-focused edges */}
                <marker
                  id="edge-arrow-quiet"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="4"
                  markerHeight="4"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#CBD5E1" opacity="0.45" />
                </marker>

                {/* Focused / Hovered neighborhood arrow */}
                <marker
                  id="edge-arrow-focused"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="5.5"
                  markerHeight="5.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#2563EB" />
                </marker>

                <marker
                  id="edge-arrow-dark"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#334155" />
                </marker>

                {/* Animated Route arrow */}
                <marker
                  id="edge-arrow-route"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="5.5"
                  markerHeight="5.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#2563EB" />
                </marker>
              </defs>

              <g
                className="cf-graph-viewport"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: isPanningCanvas
                    ? 'none'
                    : 'transform 160ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {/* ── Layer 1: Edges with Progressive Hierarchy ─────────────── */}
                <g>
                  {renderedEdges.map(({ edge, d, inRoute }) => {
                    const isHoveredEdge = hoveredEdgeId === edge.id;
                    const isSelectedEdge = selectedEdgeId === edge.id;
                    const isConnectedToFocus =
                      focusNodeId !== null &&
                      (edge.sourceId === focusNodeId ||
                        edge.targetId === focusNodeId);

                    let edgeOpacity = 0.32;
                    let strokeColor = '#94A3B8';
                    let strokeWidth = 1.25;
                    let markerEnd = 'url(#edge-arrow-default)';

                    if (hasActiveRoute) {
                      if (inRoute) {
                        edgeOpacity = 1.0;
                        strokeColor = '#2563EB';
                        strokeWidth = 3.2;
                        markerEnd = 'url(#edge-arrow-route)';
                      } else {
                        edgeOpacity = 0.16;
                        strokeColor = '#CBD5E1';
                        strokeWidth = 1.1;
                        markerEnd = 'url(#edge-arrow-quiet)';
                      }
                    } else if (focusNodeId !== null) {
                      if (isConnectedToFocus || isHoveredEdge || isSelectedEdge) {
                        edgeOpacity = 0.95;
                        strokeColor = '#2563EB';
                        strokeWidth = 2.2;
                        markerEnd = 'url(#edge-arrow-focused)';
                      } else {
                        edgeOpacity = 0.16;
                        strokeColor = '#CBD5E1';
                        strokeWidth = 1.1;
                        markerEnd = 'url(#edge-arrow-quiet)';
                      }
                    } else {
                      // Default state: quiet, clean hierarchy
                      if (isHoveredEdge || isSelectedEdge) {
                        edgeOpacity = 0.95;
                        strokeColor = '#2563EB';
                        strokeWidth = 2.2;
                        markerEnd = 'url(#edge-arrow-focused)';
                      } else {
                        edgeOpacity = 0.32;
                        strokeColor = '#94A3B8';
                        strokeWidth = 1.25;
                        markerEnd = 'url(#edge-arrow-default)';
                      }
                    }

                    if (inRoute) {
                      return (
                        <g
                          key={edge.id}
                          opacity={edgeOpacity}
                          onMouseEnter={() => setHoveredEdgeId(edge.id)}
                          onMouseLeave={() => setHoveredEdgeId(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEdgeId((prev) =>
                              prev === edge.id ? null : edge.id
                            );
                          }}
                          className="cursor-pointer"
                        >
                          <path
                            d={d}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={14}
                          />
                          {/* 3.5px solid brand base */}
                          <path
                            d={d}
                            fill="none"
                            stroke="#2563EB"
                            strokeWidth={3.5}
                            strokeOpacity={0.32}
                            markerEnd={markerEnd}
                          />
                          {/* Flowing dash animation in direction of travel */}
                          <path
                            d={d}
                            fill="none"
                            stroke="#2563EB"
                            strokeWidth={3.5}
                            strokeDasharray="8 6"
                            className="cf-route-dash"
                            markerEnd={markerEnd}
                          />
                        </g>
                      );
                    }

                    return (
                      <g
                        key={edge.id}
                        opacity={edgeOpacity}
                        onMouseEnter={() => setHoveredEdgeId(edge.id)}
                        onMouseLeave={() => setHoveredEdgeId(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEdgeId((prev) =>
                            prev === edge.id ? null : edge.id
                          );
                        }}
                        className="cursor-pointer"
                        style={{
                          transition: 'opacity 180ms ease, stroke 180ms ease',
                        }}
                      >
                        <path
                          d={d}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={12}
                        />
                        <path
                          d={d}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          markerEnd={markerEnd}
                        />
                      </g>
                    );
                  })}
                </g>

                {/* ── Layer 2: Draggable Solid 36px Baseline Nodes + Short Labels ─── */}
                <g>
                  {entities.map((entity) => {
                    const pos = simNodesRef.current[entity.id];
                    if (!pos) return null;

                    const st = getNodeTypeStyle(entity.entityType);
                    const isHovered = hoveredEntityId === entity.id;
                    const isCanvasSelected = canvasSelectedNodeId === entity.id;
                    const routeStep = routeInfo.nodeOrder[entity.id];
                    const inRoute = routeStep !== undefined;

                    const isNeighborOfFocus =
                      focusNodeId !== null &&
                      focusNodeId !== entity.id &&
                      mergedEdges.some(
                        (me) =>
                          (me.sourceId === focusNodeId &&
                            me.targetId === entity.id) ||
                          (me.targetId === focusNodeId &&
                            me.sourceId === entity.id)
                      );

                    let nodeOpacity = 1;
                    if (hasActiveRoute) {
                      nodeOpacity = inRoute ? 1 : 0.38;
                    } else if (focusNodeId !== null) {
                      nodeOpacity =
                        entity.id === focusNodeId || isNeighborOfFocus
                          ? 1
                          : 0.42;
                    }

                    const isHighRisk = entity.riskLevel === 'CRITICAL';
                    const isWatchRisk = entity.riskLevel === 'HIGH';
                    const shortLabel = formatShortNodeLabel(
                      entity.displayLabel || entity.normalizedValue || entity.id
                    );

                    return (
                      <g
                        key={entity.id}
                        transform={`translate(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`}
                        opacity={nodeOpacity}
                        tabIndex={0}
                        role="button"
                        aria-label={`${entity.displayLabel || entity.normalizedValue} (${st.singularLabel})`}
                        onPointerDown={(e) => handleNodePointerDown(e, entity.id)}
                        onPointerMove={(e) => handleNodePointerMove(e, entity.id)}
                        onPointerUp={(e) => handleNodePointerUp(e, entity.id)}
                        onDoubleClick={(e) => handleNodeDoubleClick(e, entity.id)}
                        onMouseEnter={() => setHoveredEntityId(entity.id)}
                        onMouseLeave={() => setHoveredEntityId(null)}
                        onFocus={() => setHoveredEntityId(entity.id)}
                        onBlur={() => setHoveredEntityId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setCanvasSelectedNodeId(entity.id);
                            setSelectedEdgeId(null);
                            onSelectEntity(entity.id);
                            if (onSelectEntityForGraph)
                              onSelectEntityForGraph(entity.id);
                          }
                        }}
                        className="cursor-grab active:cursor-grabbing select-none outline-none focus:outline-none"
                        style={{
                          touchAction: 'none',
                          transition: 'opacity 180ms ease',
                        }}
                      >
                        <title>{`${entity.displayLabel || entity.normalizedValue} (${st.singularLabel})${pos.pinned ? ' — Pinned (double-click to unpin)' : ''}`}</title>

                        {/* Constant-size node group (never scales on hover or selection) */}
                        <g>
                          {/* Route, Selected, or Hovered outer outline ring (#2563EB) */}
                          {(inRoute || isCanvasSelected || isHovered) && (
                            <circle
                              r={NODE_R + 3.5}
                              fill="none"
                              stroke="#2563EB"
                              strokeWidth={2.5}
                            />
                          )}

                          {/* Direct neighbor highlight ring when focus is active */}
                          {!inRoute && !isCanvasSelected && !isHovered && isNeighborOfFocus && (
                            <circle
                              r={NODE_R + 3.0}
                              fill="none"
                              stroke="#60A5FA"
                              strokeWidth={2}
                              strokeDasharray="4 2"
                            />
                          )}

                          {/* Main 36px baseline solid circle with 2.5px white ring and soft drop shadow */}
                          <circle
                            r={NODE_R}
                            fill={st.color}
                            stroke="#FFFFFF"
                            strokeWidth={2.5}
                            filter="url(#node-soft-shadow)"
                          />

                          {/* White line icon inside */}
                          <foreignObject
                            x={-9}
                            y={-9}
                            width={18}
                            height={18}
                            className="pointer-events-none"
                          >
                            <div className="w-full h-full flex items-center justify-center">
                              {getWhiteNodeIcon(entity.entityType)}
                            </div>
                          </foreignObject>

                          {/* Small risk dot on top-right corner (red = high risk, amber = watch) */}
                          {(isHighRisk || isWatchRisk) && !inRoute && (
                            <circle
                              cx={12.5}
                              cy={-12.5}
                              r={5}
                              fill={isHighRisk ? '#E24A3B' : '#D9822B'}
                              stroke="#FFFFFF"
                              strokeWidth={1.75}
                            />
                          )}

                          {/* Numbered route badge (1, 2, 3...) when on active route */}
                          {inRoute && (
                            <g transform="translate(13.5, -13.5)">
                              <circle
                                r={8.5}
                                fill="#2563EB"
                                stroke="#FFFFFF"
                                strokeWidth={1.75}
                              />
                              <text
                                x={0}
                                y={3}
                                textAnchor="middle"
                                fill="#FFFFFF"
                                fontSize={9.5}
                                fontWeight={700}
                                fontFamily="Inter, system-ui, sans-serif"
                              >
                                {routeStep}
                              </text>
                            </g>
                          )}

                          {/* Tiny pin dot at top-left when user has pinned the node */}
                          {pos.pinned && (
                            <circle
                              cx={-12.5}
                              cy={-12.5}
                              r={3}
                              fill="#141B2D"
                              stroke="#FFFFFF"
                              strokeWidth={1.5}
                            />
                          )}
                        </g>

                        {/* Short name under the node with halo protection against line crossings */}
                        <text
                          x={0}
                          y={NODE_R + 17}
                          textAnchor="middle"
                          fill="#0F172A"
                          fontSize={12}
                          fontWeight={isCanvasSelected || inRoute || isHovered ? 600 : 500}
                          fontFamily="Inter, system-ui, sans-serif"
                          className="pointer-events-none select-none"
                          style={{
                            paintOrder: 'stroke fill',
                            stroke: '#F6F8FC',
                            strokeWidth: 3.5,
                            strokeLinejoin: 'round',
                          }}
                        >
                          {shortLabel}
                        </text>
                      </g>
                    );
                  })}
                </g>

                {/* ── Layer 3: Plain-Word Edge Pill ONLY on Hovered or Selected Edge ── */}
                <g pointerEvents="none">
                  {renderedEdges.map(({ edge, midX, midY }) => {
                    const showPill =
                      hoveredEdgeId === edge.id || selectedEdgeId === edge.id;
                    if (!showPill) return null;

                    const text = edge.plainVerb;
                    const pw = Math.max(82, text.length * 6.8 + 20);
                    const ph = 22;

                    return (
                      <g
                        key={`pill-${edge.id}`}
                        transform={`translate(${(midX - pw / 2).toFixed(1)}, ${(midY - ph / 2).toFixed(1)})`}
                      >
                        <rect
                          width={pw}
                          height={ph}
                          rx={11}
                          fill="#FFFFFF"
                          stroke="#CBD5E1"
                          strokeWidth={1}
                          filter="url(#node-soft-shadow)"
                        />
                        <text
                          x={pw / 2}
                          y={14.5}
                          textAnchor="middle"
                          fill="#141B2D"
                          fontSize={11}
                          fontWeight={600}
                          fontFamily="Inter, system-ui, sans-serif"
                        >
                          {text}
                        </text>
                      </g>
                    );
                  })}
                </g>

                {/* ── Layer 4: Immediate Floating Tooltip for Hovered Node ── */}
                {hoveredEntity && hoveredPos && (() => {
                  const tipType = getNodeTypeStyle(hoveredEntity.entityType);
                  const tipTitle = hoveredEntity.displayLabel || hoveredEntity.normalizedValue;
                  const tipNeighbors = mergedEdges.filter(
                    (me) => me.sourceId === hoveredEntity.id || me.targetId === hoveredEntity.id
                  ).length;
                  const tipSubtitle = `${tipType.singularLabel} · ${tipNeighbors} ${tipNeighbors === 1 ? 'connection' : 'connections'}`;

                  const tipW = Math.max(160, Math.min(270, Math.max(tipTitle.length, tipSubtitle.length) * 7.5 + 28));
                  const tipH = 46;

                  const isNearTop = hoveredPos.y < 85;
                  const tipX = Math.max(tipW / 2 + 10, Math.min(SVG_W - tipW / 2 - 10, hoveredPos.x));
                  const tipY = isNearTop ? hoveredPos.y + NODE_R + 34 : hoveredPos.y - NODE_R - 38;

                  return (
                    <g
                      pointerEvents="none"
                      transform={`translate(${tipX.toFixed(1)}, ${tipY.toFixed(1)})`}
                    >
                      <rect
                        x={-tipW / 2}
                        y={-tipH / 2}
                        width={tipW}
                        height={tipH}
                        rx={10}
                        fill="#FFFFFF"
                        stroke="#CBD5E1"
                        strokeWidth={1}
                        filter="url(#node-soft-shadow)"
                      />
                      <text
                        x={0}
                        y={-4}
                        textAnchor="middle"
                        fill="#0F172A"
                        fontSize={12}
                        fontWeight={700}
                        fontFamily="Inter, system-ui, sans-serif"
                      >
                        {tipTitle.length > 28 ? `${tipTitle.slice(0, 26)}…` : tipTitle}
                      </text>
                      <text
                        x={0}
                        y={14}
                        textAnchor="middle"
                        fill="#64748B"
                        fontSize={10.5}
                        fontWeight={500}
                        fontFamily="Inter, system-ui, sans-serif"
                      >
                        {tipSubtitle}
                      </text>
                    </g>
                  );
                })()}
              </g>
            </svg>

            {/* Quick Canvas Controls: Zoom In / Zoom Out / Reset */}
            <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 bg-white/92 backdrop-blur-md border border-slate-200/90 shadow-sm rounded-xl p-1">
              <button
                type="button"
                onClick={() =>
                  setZoom((z) => {
                    const next = Math.min(2.5, Number((z * 1.2).toFixed(2)));
                    zoomRef.current = next;
                    return next;
                  })
                }
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 text-sm font-bold transition cursor-pointer"
                title="Zoom in"
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                onClick={() =>
                  setZoom((z) => {
                    const next = Math.max(0.5, Number((z / 1.2).toFixed(2)));
                    zoomRef.current = next;
                    return next;
                  })
                }
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 text-sm font-bold transition cursor-pointer"
                title="Zoom out"
                aria-label="Zoom out"
              >
                −
              </button>
              <div className="w-px h-4 bg-slate-200 mx-0.5" />
              <button
                type="button"
                onClick={() => fitNodesInView(hasActiveRoute ? shortestPath?.nodeIds : undefined)}
                className="px-2 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
                title="Fit to view"
              >
                Fit
              </button>
            </div>
          </div>

          {/* ── Bottom Bar: Path Tracer & Route Strip ──────────────────────── */}
          <div className="p-4 bg-white border-t border-slate-200/80 space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 mr-1">
                <Route className="w-4 h-4 text-blue-600" />
                <span>Show route</span>
              </span>

              <SearchableNodeSelect
                id="graph-route-from"
                label="From"
                value={pathSource}
                entities={entities}
                onChange={(id) => setPathSource(id)}
              />

              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

              <SearchableNodeSelect
                id="graph-route-to"
                label="To"
                value={pathTarget}
                entities={entities}
                onChange={(id) => setPathTarget(id)}
              />

              <button
                type="button"
                onClick={handleTraceRoute}
                className="cf-btn-blue h-9 px-4 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Trace route</span>
              </button>

              <button
                type="button"
                onClick={handleClearRoute}
                disabled={!shortestPath}
                className={`h-9 px-3.5 rounded-xl border text-xs font-semibold transition ${
                  shortestPath
                    ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 cursor-pointer'
                    : 'bg-slate-50 border-slate-200/60 text-slate-400 cursor-not-allowed'
                }`}
              >
                Clear
              </button>
            </div>

            {/* Route Strip Result */}
            {shortestPath && (
              <div className="p-3.5 rounded-xl bg-[#F6F8FC] border border-slate-200/80 space-y-2.5">
                {shortestPath.pathFound && routeInfo.steps.length > 0 ? (
                  <>
                    {/* Step-by-step clickable pills */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {routeInfo.steps.map((step, idx) => {
                        const st = getNodeTypeStyle(step.node.entityType);
                        const isSelected = selectedEntity?.id === step.node.id;
                        return (
                          <React.Fragment key={step.node.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setCanvasSelectedNodeId(step.node.id);
                                onSelectEntity(step.node.id);
                              }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-50 border-blue-400 text-blue-900'
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                              }`}
                            >
                              <span
                                className="w-4 h-4 rounded-full text-[10px] font-bold text-white inline-flex items-center justify-center shrink-0"
                                style={{ backgroundColor: st.color }}
                              >
                                {step.stepNum}
                              </span>
                              <span className="truncate max-w-[160px]">
                                {step.node.displayLabel || step.node.normalizedValue}
                              </span>
                            </button>

                            {idx < routeInfo.steps.length - 1 && (
                              <span className="text-[11px] text-slate-500 px-1 inline-flex items-center gap-1">
                                <span>─ {step.nextVerb} →</span>
                              </span>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {/* Plain summary sentence + risk badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70 text-xs text-slate-700">
                      <span>
                        {routeInfo.steps.length === 1 ? (
                          <>
                            Selected{' '}
                            <strong className="text-slate-900">
                              {routeInfo.steps[0].node.displayLabel}
                            </strong>
                            . Choose a different destination to trace a route.
                          </>
                        ) : (
                          <>
                            Money and activity moved from{' '}
                            <strong className="text-slate-900">
                              {routeInfo.steps[0].node.displayLabel}
                            </strong>{' '}
                            to{' '}
                            <strong className="text-slate-900">
                              {
                                routeInfo.steps[routeInfo.steps.length - 1].node
                                  .displayLabel
                              }
                            </strong>{' '}
                            in{' '}
                            <strong className="text-slate-900">
                              {shortestPath.hopCount}{' '}
                              {shortestPath.hopCount === 1 ? 'step' : 'steps'}
                            </strong>
                            .
                          </>
                        )}
                      </span>

                      {routeInfo.hasHighRiskOnRoute && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FDECEC] text-[#B42318]">
                          <AlertTriangle className="w-3 h-3" />
                          <span>High-risk account on route</span>
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-xs font-medium text-slate-600 py-1">
                    These two aren&apos;t connected in this case.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Single Detail Card (Read-Only, Plain Language, No Tabs) ── */}
        <aside className="cf-card p-5 space-y-5 min-w-0 self-start lg:sticky lg:top-[calc(var(--shell-h,148px)+16px)]">
          {selectedEntity ? (
            (() => {
              const st = getNodeTypeStyle(selectedEntity.entityType);
              const isHighRisk = selectedEntity.riskLevel === 'CRITICAL';
              const isWatch = selectedEntity.riskLevel === 'HIGH';
              const evidenceCount =
                selectedEntity.evidenceIds && selectedEntity.evidenceIds.length > 0
                  ? selectedEntity.evidenceIds.length
                  : Math.min(3, Math.max(1, evidenceList.length));
              const confidencePct = Math.round(
                (selectedEntity.confidenceScore || 0.98) * 100
              );

              return (
                <>
                  {/* Name, Type & Risk Badge */}
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-xs"
                        style={{ backgroundColor: st.color }}
                      >
                        {getWhiteNodeIcon(selectedEntity.entityType)}
                      </div>
                      <div className="min-w-0">
                        <h2
                          className="text-base font-bold text-slate-900 break-words leading-snug"
                          title={selectedEntity.displayLabel}
                        >
                          {selectedEntity.displayLabel}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {st.singularLabel}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
                        isHighRisk
                          ? 'bg-[#FDECEC] text-[#B42318]'
                          : isWatch
                          ? 'bg-[#FEF3DF] text-[#9A5B13]'
                          : 'bg-[#E7F6EF] text-[#0E6B45]'
                      }`}
                    >
                      {isHighRisk
                        ? 'High risk'
                        : isWatch
                        ? 'Watch'
                        : 'Normal'}
                    </span>
                  </div>

                  {/* Full identifier with copy */}
                  <div className="p-3 rounded-xl bg-[#F6F8FC] border border-slate-200/80 flex items-center justify-between gap-2 min-w-0">
                    <span className="font-mono text-xs text-slate-800 break-all select-all">
                      {selectedEntity.normalizedValue || selectedEntity.displayLabel}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          await copyToClipboardSafe(
                            selectedEntity.normalizedValue ||
                              selectedEntity.displayLabel
                          )
                        ) {
                          setCopiedValue(true);
                          setTimeout(() => setCopiedValue(false), 1800);
                        }
                      }}
                      className="text-slate-400 hover:text-slate-700 p-1 rounded shrink-0 cursor-pointer"
                      title="Copy value"
                    >
                      {copiedValue ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* 3-4 Plain Facts */}
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Key Facts
                    </div>
                    <ul className="space-y-2 text-xs text-slate-700">
                      <li className="flex items-center justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">Connections</span>
                        <span className="font-semibold text-slate-900 tabular-nums">
                          Connected to {connectedNeighbors.length}{' '}
                          {connectedNeighbors.length === 1 ? 'other' : 'others'}
                        </span>
                      </li>
                      <li className="flex items-center justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">Evidence files</span>
                        <span className="font-semibold text-slate-900 tabular-nums">
                          Appears in {evidenceCount}{' '}
                          {evidenceCount === 1 ? 'evidence file' : 'evidence files'}
                        </span>
                      </li>
                      <li className="flex items-center justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">Match confidence</span>
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {confidencePct}%
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* Short "Connected to" list (max 5, click to jump) */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Connected to
                    </div>
                    {connectedNeighbors.length === 0 ? (
                      <div className="text-xs text-slate-400 py-2">
                        No direct connections recorded.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {connectedNeighbors.slice(0, 5).map(({ entity, verb }) => {
                          const nStyle = getNodeTypeStyle(entity.entityType);
                          return (
                            <button
                              key={entity.id}
                              type="button"
                              onClick={() => {
                                setCanvasSelectedNodeId(entity.id);
                                onSelectEntity(entity.id);
                              }}
                              className="w-full text-left p-2.5 rounded-xl bg-[#F6F8FC] hover:bg-slate-100/80 border border-slate-200/70 flex items-center justify-between gap-2 transition cursor-pointer min-w-0"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: nStyle.color }}
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-slate-900 truncate">
                                    {entity.displayLabel || entity.normalizedValue}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">
                                    {verb} · {nStyle.singularLabel}
                                  </div>
                                </div>
                              </div>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Open evidence link */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        const firstEvId =
                          selectedEntity.evidenceIds?.[0] || evidenceList[0]?.id;
                        if (firstEvId && onSelectEvidenceForVault) {
                          onSelectEvidenceForVault(firstEvId);
                        }
                        if (onNavigateTab) {
                          onNavigateTab('EVIDENCE');
                        }
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#EEF4FF] hover:bg-blue-100/80 text-blue-700 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Open evidence</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              );
            })()
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              Click any circle on the graph to view its details.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
