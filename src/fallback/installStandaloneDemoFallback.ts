import rawSeed from './demoSeedSnapshot.json';
import {
  buildReportModel,
  generateReportPdfBytes,
  generateReportMarkdown,
  buildSanitizedReportFilename,
  triggerSafeBlobDownload,
} from '../lib/reportBuilder';

interface FallbackState {
  cases: any[];
  demoUsersResponse: any;
  usersResponse: any;
  byCase: Record<string, any>;
  customImages: Record<string, string>;
}

const DB_NAME = 'cyberfusion_x_workspace_db';
const DB_VERSION = 1;
const STORE_NAME = 'workspace_state';
const LS_CACHE_KEY = 'cyberfusion_x_workspace_v1';

const COUNTRY_COORDS: Record<string, { lat: number; lon: number }> = {
  India: { lat: 19.076, lon: 72.8777 },
  Germany: { lat: 50.1109, lon: 8.6821 },
  'United States': { lat: 38.8951, lon: -77.0364 },
  'United Kingdom': { lat: 51.5072, lon: -0.1276 },
  Singapore: { lat: 1.3521, lon: 103.8198 },
  'United Arab Emirates': { lat: 25.2048, lon: 55.2708 },
  Netherlands: { lat: 52.3676, lon: 4.9041 },
  Switzerland: { lat: 47.3769, lon: 8.5417 },
  Estonia: { lat: 59.437, lon: 24.7536 },
  Seychelles: { lat: -4.6796, lon: 55.492 },
  Cyprus: { lat: 35.1856, lon: 33.3823 },
  'Hong Kong': { lat: 22.3193, lon: 114.1694 },
};

function deterministicHex64(seedStr: string): string {
  let h1 = 0xdeadbeef ^ seedStr.length;
  let h2 = 0x41c6ce57 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    const ch = seedStr.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  const chunks: string[] = [];
  for (let k = 0; k < 8; k++) {
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const val = (h1 >>> 0).toString(16).padStart(8, '0');
    chunks.push(val);
  }
  return chunks.join('').slice(0, 64);
}

function cloneSeed(): FallbackState {
  const cloned = JSON.parse(JSON.stringify(rawSeed));
  return {
    ...cloned,
    customImages: {},
  };
}

function loadStateFromLocalCache(): FallbackState | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(LS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.schemaVersion === DB_VERSION && Array.isArray(parsed.cases) && parsed.byCase) {
      return {
        cases: parsed.cases,
        demoUsersResponse: parsed.demoUsersResponse || (rawSeed as any).demoUsersResponse,
        usersResponse: parsed.usersResponse || (rawSeed as any).usersResponse,
        byCase: parsed.byCase,
        customImages: parsed.customImages || {},
      };
    }
  } catch {
    // Ignore storage block or quota error
  }
  return null;
}

function openWorkspaceIndexedDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined' || !window.indexedDB) {
        resolve(null);
        return;
      }
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function savePersistedWorkspaceState(state: FallbackState): Promise<void> {
  const payload = {
    schemaVersion: DB_VERSION,
    updatedAt: new Date().toISOString(),
    cases: state.cases,
    demoUsersResponse: state.demoUsersResponse,
    usersResponse: state.usersResponse,
    byCase: state.byCase,
    customImages: state.customImages,
  };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LS_CACHE_KEY, JSON.stringify(payload));
    }
  } catch {
    // Ignore localStorage quota exceeded
  }
  try {
    const db = await openWorkspaceIndexedDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(payload, 'active_workspace');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore IndexedDB error
  }
}

async function clearPersistedWorkspaceState(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LS_CACHE_KEY);
    }
  } catch {
    // Ignore
  }
  try {
    const db = await openWorkspaceIndexedDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete('active_workspace');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}

function recomputeCaseDerivedMetrics(caseSummary: any, bundle: any) {
  const entities: any[] = Array.isArray(bundle.entities?.entities)
    ? bundle.entities.entities
    : [];
  const relationships: any[] = Array.isArray(bundle.entities?.relationships)
    ? bundle.entities.relationships
    : [];
  const evidenceList: any[] = Array.isArray(bundle.evidence?.evidence)
    ? bundle.evidence.evidence
    : [];
  const timelineList: any[] = Array.isArray(bundle.timeline?.timeline)
    ? bundle.timeline.timeline
    : [];

  // 1. Compute iterative PageRank across entities
  const n = entities.length;
  if (n > 0) {
    const damping = 0.85;
    const pr = new Map<string, number>();
    const outLinks = new Map<string, string[]>();
    const inLinks = new Map<string, string[]>();
    entities.forEach((e) => {
      pr.set(e.id, 1 / n);
      outLinks.set(e.id, []);
      inLinks.set(e.id, []);
    });
    relationships.forEach((rel) => {
      if (outLinks.has(rel.sourceEntityId) && inLinks.has(rel.targetEntityId)) {
        outLinks.get(rel.sourceEntityId)!.push(rel.targetEntityId);
        inLinks.get(rel.targetEntityId)!.push(rel.sourceEntityId);
      }
      if (outLinks.has(rel.targetEntityId) && inLinks.has(rel.sourceEntityId)) {
        outLinks.get(rel.targetEntityId)!.push(rel.sourceEntityId);
        inLinks.get(rel.sourceEntityId)!.push(rel.targetEntityId);
      }
    });

    for (let iter = 0; iter < 18; iter++) {
      const nextPr = new Map<string, number>();
      entities.forEach((e) => {
        let sum = 0;
        const incoming = inLinks.get(e.id) || [];
        incoming.forEach((srcId) => {
          const deg = (outLinks.get(srcId) || []).length || 1;
          sum += (pr.get(srcId) || 0) / deg;
        });
        nextPr.set(e.id, (1 - damping) / n + damping * sum);
      });
      nextPr.forEach((val, k) => pr.set(k, val));
    }

    const maxPr = Math.max(0.01, ...Array.from(pr.values()));
    entities.forEach((e, idx) => {
      const normalizedPr = Number(Math.min(0.99, ((pr.get(e.id) || 0) / maxPr) * 0.92 + 0.06).toFixed(3));
      e.pagerankScore = e.pagerankScore && caseSummary.caseOrigin === 'PRELOADED' ? e.pagerankScore : normalizedPr;
      const deg = (outLinks.get(e.id) || []).length;
      e.betweennessScore = e.betweennessScore && caseSummary.caseOrigin === 'PRELOADED'
        ? e.betweennessScore
        : Number(Math.min(0.95, deg / Math.max(1, n)).toFixed(3));
      if (typeof e.clusterId !== 'number') {
        e.clusterId = (idx % 3) + 1;
      }
      if (e.country && COUNTRY_COORDS[e.country] && (e.lat === undefined || e.lon === undefined)) {
        e.lat = COUNTRY_COORDS[e.country].lat;
        e.lon = COUNTRY_COORDS[e.country].lon;
      }
    });
  }

  // 2. Sync graph.nodes & graph.edges
  bundle.graph = bundle.graph || {};
  bundle.graph.caseId = caseSummary.id;
  bundle.graph.nodes = entities.map((e) => ({
    id: e.id,
    label: e.displayLabel || e.normalizedValue,
    type: e.entityType,
    role: e.roleInIncident,
    riskLevel: e.riskLevel,
    pagerankScore: e.pagerankScore || 0.25,
    betweennessScore: e.betweennessScore || 0.1,
    clusterId: e.clusterId || 1,
  }));
  bundle.graph.edges = relationships.map((r) => ({
    id: r.id,
    source: r.sourceEntityId,
    target: r.targetEntityId,
    type: r.relationshipType,
    label: r.label || r.relationshipType,
    weight: r.weight || 5.0,
    evidenceIds: r.evidenceId ? [r.evidenceId] : [],
  }));

  // 3. Sort timeline chronologically (undated items last)
  timelineList.sort((a, b) => {
    const tA = a.eventTimestamp ? Date.parse(a.eventTimestamp) : NaN;
    const tB = b.eventTimestamp ? Date.parse(b.eventTimestamp) : NaN;
    if (Number.isNaN(tA) && Number.isNaN(tB)) return 0;
    if (Number.isNaN(tA)) return 1;
    if (Number.isNaN(tB)) return -1;
    return tA - tB;
  });
  if (bundle.timeline) {
    bundle.timeline.timeline = timelineList;
    bundle.timeline.events = timelineList;
    bundle.timeline.count = timelineList.length;
    bundle.timeline.anomalyCount = timelineList.filter((t) => t.anomalyFlag).length;
  }

  // 4. Update counts on caseSummary
  const intactCount = evidenceList.filter((e) => e.integrityStatus === 'VERIFIED_INTACT').length;
  const tamperedCount = evidenceList.filter((e) => e.integrityStatus === 'TAMPER_DETECTED').length;
  const evAnomalies = evidenceList.filter((e) => e.timestampAnomaly).length;
  const tlAnomalies = timelineList.filter((t) => t.anomalyFlag).length;

  caseSummary.evidenceCount = evidenceList.length;
  caseSummary.verifiedIntactCount = intactCount;
  caseSummary.tamperedCount = tamperedCount;
  caseSummary.entityCount = entities.length;
  caseSummary.relationshipCount = relationships.length;
  caseSummary.timelineEventCount = timelineList.length;
  caseSummary.metadataAnomalyCount = Math.max(evAnomalies, tlAnomalies);
  caseSummary.updatedAt = new Date().toISOString();

  // For user-created cases, derive riskIndicators and riskScore deterministically
  if (caseSummary.caseOrigin === 'USER_CREATED') {
    const indicators: any[] = [];
    const highRiskEnts = entities.filter(
      (e) => e.riskLevel === 'CRITICAL' || e.riskLevel === 'HIGH'
    );
    if (highRiskEnts.length > 0) {
      indicators.push({
        id: `ri-ent-${caseSummary.id}`,
        code: 'CFX-ENT-HIGH',
        category: 'ENTITY_CORRELATION',
        severity: highRiskEnts.some((e) => e.riskLevel === 'CRITICAL') ? 'CRITICAL' : 'HIGH',
        scoreImpact: Math.min(35, highRiskEnts.length * 12),
        title: `${highRiskEnts.length} High-Risk Actor / Account Node(s)`,
        description: `Identified ${highRiskEnts.map((e) => e.displayLabel).slice(0, 3).join(', ')} in case network.`,
        evidenceRef: evidenceList[0]?.evidenceCode || 'GRAPH',
        mitreTechnique: 'T1656 / Financial Layering',
      });
    }
    if (caseSummary.metadataAnomalyCount > 0) {
      indicators.push({
        id: `ri-anom-${caseSummary.id}`,
        code: 'CFX-META-ANOMALY',
        category: 'METADATA_ANOMALY',
        severity: 'HIGH',
        scoreImpact: Math.min(25, caseSummary.metadataAnomalyCount * 15),
        title: `${caseSummary.metadataAnomalyCount} Timestamp / Metadata Discrepancy Flagged`,
        description: 'Timeline or file metadata check flagged a timing discrepancy requiring verification.',
        evidenceRef: evidenceList[0]?.evidenceCode || 'TIMELINE',
        mitreTechnique: 'T1070 / Indicator Manipulation',
      });
    }
    const unverifiedEnts = entities.filter(
      (e) => !Array.isArray(e.evidenceIds) || e.evidenceIds.length === 0
    );
    if (unverifiedEnts.length > 0 && evidenceList.length > 0) {
      indicators.push({
        id: `ri-unver-${caseSummary.id}`,
        code: 'CFX-UNLINKED-ENTITY',
        category: 'EVIDENCE_LINKAGE',
        severity: 'MEDIUM',
        scoreImpact: 10,
        title: `${unverifiedEnts.length} Entity Node(s) Without Linked Evidence File`,
        description: `${unverifiedEnts.map((e) => e.displayLabel).slice(0, 3).join(', ')} entered without a linked supporting file.`,
        evidenceRef: 'STAGE-3-GRAPH',
        mitreTechnique: 'Unverified Source Attribution',
      });
    }
    const txs: any[] = Array.isArray(caseSummary.transactions) ? caseSummary.transactions : [];
    const missingRefTxs = txs.filter((tx) => !tx.referenceId || !String(tx.referenceId).trim());
    if (missingRefTxs.length > 0) {
      indicators.push({
        id: `ri-txref-${caseSummary.id}`,
        code: 'CFX-TX-UNRESOLVED',
        category: 'FINANCIAL_TRACE',
        severity: 'MEDIUM',
        scoreImpact: 12,
        title: `${missingRefTxs.length} Financial Movement(s) Missing Reference ID`,
        description: 'Transfer recorded without UTR/IMPS/SWIFT/TXN reference; possible duplicate unresolved.',
        evidenceRef: 'STAGE-6-REPORT',
        mitreTechnique: 'Unindexed Settlement Hop',
      });
    }

    caseSummary.riskIndicators = indicators;

    const baseBySeverity =
      caseSummary.severity === 'CRITICAL'
        ? 68
        : caseSummary.severity === 'HIGH'
        ? 52
        : caseSummary.severity === 'MEDIUM'
        ? 34
        : 18;
    const boost =
      Math.min(18, highRiskEnts.length * 6) +
      Math.min(10, caseSummary.metadataAnomalyCount * 5) +
      (tamperedCount > 0 ? 12 : 0) +
      (txs.length > 0 ? 5 : 0);
    caseSummary.riskScore = Math.min(99, baseBySeverity + boost);
  }
}

function renderSyntheticEvidenceDataUrl(
  evidenceCode: string,
  title: string,
  category: string,
  lines: string[]
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 920;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 720, 920);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(24, 24, 672, 872);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, 672, 872);

  ctx.fillStyle = '#eff6ff';
  ctx.fillRect(26, 26, 668, 86);
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(26, 26, 668, 6);

  ctx.fillStyle = '#1d4ed8';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`CYBERFUSION X // DIGITAL FORENSIC ARTIFACT [${evidenceCode}]`, 48, 56);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText(title.slice(0, 48), 48, 84);

  ctx.fillStyle = '#475569';
  ctx.font = '12px monospace';
  ctx.fillText(`CATEGORY: ${category}   |   CHAIN-OF-CUSTODY: WORM-SEALED`, 48, 103);

  const BOX_X = 44;
  const FIRST_BOX_Y = 144;
  const LINE_STEP = 64;
  const BOX_W = 632;
  const BOX_H = 42;

  lines.forEach((line, i) => {
    const boxY = FIRST_BOX_Y + i * LINE_STEP;
    const isIoc =
      line.includes('@') ||
      line.includes('+') ||
      line.includes('UTR') ||
      line.includes('IMPS') ||
      line.includes('185.') ||
      line.includes('TQn9');
    ctx.fillStyle = isIoc ? '#fffbeb' : '#f8fafc';
    ctx.fillRect(BOX_X, boxY, BOX_W, BOX_H);
    ctx.strokeStyle = isIoc ? '#fcd34d' : '#e2e8f0';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(BOX_X, boxY, BOX_W, BOX_H);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(String(i + 1).padStart(2, '0'), BOX_X + 12, boxY + 26);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(line.slice(0, 62), BOX_X + 42, boxY + 26);
  });

  return canvas.toDataURL('image/png');
}

export function installStandaloneDemoFallback() {
  const nativeFetch = window.fetch.bind(window);
  let state: FallbackState = loadStateFromLocalCache() || cloneSeed();
  let standaloneModeActive = false;

  // Also hydrate asynchronously from IndexedDB if available and newer
  openWorkspaceIndexedDb().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('active_workspace');
      req.onsuccess = () => {
        const val = req.result;
        if (val && val.schemaVersion === DB_VERSION && Array.isArray(val.cases) && val.byCase) {
          state = {
            cases: val.cases,
            demoUsersResponse: val.demoUsersResponse || state.demoUsersResponse,
            usersResponse: val.usersResponse || state.usersResponse,
            byCase: val.byCase,
            customImages: val.customImages || state.customImages || {},
          };
        }
      };
    } catch {
      // Ignore
    }
  });

  const jsonResp = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const enableDomInterceptors = () => {
    if (standaloneModeActive) return;
    standaloneModeActive = true;

    const rewriteImages = () => {
      document.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
        const rawAttr = img.getAttribute('src') || '';
        const m = rawAttr.match(/\/api\/v1\/evidence\/([^/?#]+)\/raw/);
        if (m) {
          const evId = decodeURIComponent(m[1]);
          const nextSrc = state.customImages[evId] || `./demo-vault/${evId}.png`;
          if (img.src !== nextSrc && !img.src.endsWith(`/demo-vault/${evId}.png`)) {
            img.src = nextSrc;
          }
        }
      });
    };

    rewriteImages();
    const observer = new MutationObserver(() => rewriteImages());
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });

    document.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement)?.closest?.('a');
      if (!target) return;
      const href = target.getAttribute('href') || '';
      if (!href.startsWith('/api/v1/reports/')) return;
      e.preventDefault();
      const url = new URL(href, window.location.origin);
      const caseId = url.searchParams.get('caseId') || 'case-phantom-upi-01';
      const caseBundle = state.byCase[caseId] || state.byCase['case-phantom-upi-01'];

      const caseSummary =
        state.cases.find((c: any) => c.id === caseId) || state.cases[0];
      const model = buildReportModel({
        activeCase: caseSummary,
        evidenceList: caseBundle.evidence?.evidence || [],
        entities: caseBundle.entities?.entities || [],
        relationships: caseBundle.entities?.relationships || [],
        timeline: caseBundle.timeline?.timeline || [],
        verifications: caseBundle.verifications?.verifications || [],
        ledger: caseBundle.ledger?.ledger || [],
        chainVerification: caseBundle.ledger?.chainVerification || null,
      });

      if (href.includes('/api/v1/reports/markdown')) {
        const mdText = generateReportMarkdown(model);
        const blob = new Blob([mdText], {
          type: 'text/markdown;charset=utf-8',
        });
        triggerSafeBlobDownload(
          blob,
          buildSanitizedReportFilename(
            model.metadata.caseNumber,
            model.metadata.generatedAtUtc,
            'md'
          )
        );
      } else if (href.includes('/api/v1/reports/stix')) {
        const blob = new Blob([JSON.stringify(model, null, 2)], {
          type: 'application/json;charset=utf-8',
        });
        triggerSafeBlobDownload(
          blob,
          buildSanitizedReportFilename(
            model.metadata.caseNumber,
            model.metadata.generatedAtUtc,
            'json'
          )
        );
      } else if (href.includes('/api/v1/reports/pdf')) {
        generateReportPdfBytes(model).then((result) => {
          const blob = new Blob([result.bytes as unknown as BlobPart], {
            type: 'application/pdf',
          });
          triggerSafeBlobDownload(
            blob,
            buildSanitizedReportFilename(
              model.metadata.caseNumber,
              model.metadata.generatedAtUtc,
              'pdf'
            )
          );
        });
      }
    });
  };

  async function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  function hydrateStructuredCasePayload(
    caseId: string,
    caseNumber: string,
    bodyJson: Record<string, any>,
    existingCase?: any,
    existingBundle?: any
  ) {
    const nowIso = new Date().toISOString();
    const isPreloaded =
      existingCase?.caseOrigin === 'PRELOADED' ||
      caseId.startsWith('case-phantom-upi') ||
      caseId.startsWith('case-bec-swift');

    const rawEntities: any[] = Array.isArray(bodyJson.entities)
      ? bodyJson.entities
      : existingBundle?.entities?.entities || [];

    const entities = rawEntities.map((ent, idx) => {
      const entId = ent.id || `ent-${caseId}-${idx + 1}`;
      const country = ent.country || ent.osintEnrichment?.country || '';
      const coords = country && COUNTRY_COORDS[country] ? COUNTRY_COORDS[country] : undefined;
      return {
        id: entId,
        caseId,
        entityType: ent.entityType || 'BANK_ACCOUNT',
        normalizedValue: ent.normalizedValue || ent.displayLabel || `ID-${idx + 1}`,
        displayLabel: ent.displayLabel || ent.normalizedValue || `Entity ${idx + 1}`,
        roleInIncident: ent.roleInIncident || 'SUSPECT',
        confidenceScore: typeof ent.confidenceScore === 'number' ? ent.confidenceScore : 0.95,
        riskLevel: ent.riskLevel || 'HIGH',
        pagerankScore: typeof ent.pagerankScore === 'number' ? ent.pagerankScore : 0.45,
        betweennessScore: typeof ent.betweennessScore === 'number' ? ent.betweennessScore : 0.2,
        clusterId: typeof ent.clusterId === 'number' ? ent.clusterId : (idx % 3) + 1,
        osintEnrichment: {
          ...(ent.osintEnrichment || {}),
          ...(country ? { country } : {}),
          ...(ent.notes ? { notes: ent.notes } : {}),
        },
        evidenceIds: Array.isArray(ent.evidenceIds) ? ent.evidenceIds : [],
        mentions: Array.isArray(ent.mentions) ? ent.mentions : [],
        firstSeenAt: ent.firstSeenAt || nowIso,
        country: country || undefined,
        city: ent.city || undefined,
        lat: typeof ent.lat === 'number' ? ent.lat : coords?.lat,
        lon: typeof ent.lon === 'number' ? ent.lon : coords?.lon,
      };
    });

    const rawTransactions: any[] = Array.isArray(bodyJson.transactions)
      ? bodyJson.transactions
      : existingCase?.transactions || [];

    const transactions = rawTransactions.map((tx, idx) => {
      const fromEnt = entities.find(
        (e) => e.id === tx.fromEntityId || e.displayLabel === tx.fromParty || e.normalizedValue === tx.fromParty
      );
      const toEnt = entities.find(
        (e) => e.id === tx.toEntityId || e.displayLabel === tx.toParty || e.normalizedValue === tx.toParty
      );
      return {
        id: tx.id || `tx-${caseId}-${idx + 1}`,
        caseId,
        fromEntityId: fromEnt?.id || tx.fromEntityId || undefined,
        fromParty: fromEnt?.displayLabel || tx.fromParty || 'Origin Account',
        toEntityId: toEnt?.id || tx.toEntityId || undefined,
        toParty: toEnt?.displayLabel || tx.toParty || 'Destination Account',
        amount: typeof tx.amount === 'number' ? tx.amount : parseFloat(String(tx.amount || '0')) || 0,
        currency: (tx.currency || 'USD').toUpperCase(),
        timestamp: tx.timestamp || nowIso,
        channel: tx.channel || 'WIRE',
        referenceId: tx.referenceId || '',
        evidenceId: tx.evidenceId || undefined,
        notes: tx.notes || '',
      };
    });

    const rawEvidence: any[] = Array.isArray(bodyJson.evidence)
      ? bodyJson.evidence
      : existingBundle?.evidence?.evidence || [];

    const evidence = rawEvidence.map((ev, idx) => {
      const evCode = ev.evidenceCode || `EVD-${String(idx + 1).padStart(3, '0')}`;
      const evId = ev.id || `evd-${caseId}-${idx + 1}`;
      const sha256 =
        ev.sha256Hash ||
        ev.clientProvidedSha256 ||
        deterministicHex64(`${caseId}-${evCode}-${ev.originalFilename || idx}`);
      const blake3 =
        ev.blake3Hash ||
        deterministicHex64(`blake3-${sha256}`);
      const contentLines = (ev.ocrRawText || ev.extractedText || `File: ${ev.originalFilename || evCode}\nSHA-256: ${sha256}`)
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(0, 10);

      if (ev.dataUrl) {
        state.customImages[evId] = ev.dataUrl;
      } else if (!state.customImages[evId] && !evId.startsWith('ev-0')) {
        state.customImages[evId] = renderSyntheticEvidenceDataUrl(
          evCode,
          ev.title || ev.originalFilename || evCode,
          ev.evidenceCategory || 'TRANSACTION_RECEIPT',
          contentLines
        );
      }

      // Link any entity whose evidenceIds should include this evidence
      if (Array.isArray(ev.linkedEntityIds)) {
        ev.linkedEntityIds.forEach((entId: string) => {
          const foundEnt = entities.find((e) => e.id === entId);
          if (foundEnt && !foundEnt.evidenceIds.includes(evId) && !foundEnt.evidenceIds.includes(evCode)) {
            foundEnt.evidenceIds.push(evCode);
          }
        });
      }

      return {
        id: evId,
        caseId,
        evidenceCode: evCode,
        title: ev.title || ev.originalFilename || evCode,
        category: ev.evidenceCategory || 'TRANSACTION_RECEIPT',
        evidenceCategory: ev.evidenceCategory || 'TRANSACTION_RECEIPT',
        originalFilename: ev.originalFilename || `${evCode.toLowerCase()}.png`,
        originalFileName: ev.originalFilename || `${evCode.toLowerCase()}.png`,
        detectedMimeType: ev.detectedMimeType || 'image/png',
        fileSizeBytes: typeof ev.fileSizeBytes === 'number' ? ev.fileSizeBytes : 24576,
        storagePath: `/vault/${caseId}/${evId}_${ev.originalFilename || 'artifact.bin'}`,
        sha256Hash: sha256,
        blake3Hash: blake3,
        clientProvidedSha256: sha256,
        transitVerified: true,
        integrityStatus: ev.integrityStatus || 'VERIFIED_INTACT',
        tamperedFlag: ev.integrityStatus === 'TAMPER_DETECTED',
        exifMetadata: ev.exifMetadata || {
          FileName: ev.originalFilename || `${evCode.toLowerCase()}.png`,
          DetectedMimeType: ev.detectedMimeType || 'image/png',
          ForensicIngestTimestampUTC: ev.uploadedAt || nowIso,
          Notes: ev.notes || 'Sealed in Evidence Vault',
        },
        ocrRawText: ev.ocrRawText || contentLines.join('\n'),
        extractedText: ev.ocrRawText || contentLines.join('\n'),
        ocrConfidence: 0.98,
        boundingBoxes: Array.isArray(ev.boundingBoxes)
          ? ev.boundingBoxes
          : contentLines.map((line: string, bIdx: number) => ({
              id: `bbox-${evId}-${bIdx + 1}`,
              blockId: `BLK-${bIdx + 1}`,
              text: line,
              x: 44,
              y: 144 + bIdx * 64,
              width: 632,
              height: 42,
              confidence: 0.98,
              entityType: line.includes('@') ? 'UPI_ID' : line.includes('+') ? 'PHONE' : 'TEXT_LINE',
            })),
        processingStage: 'SEALED',
        timestampAnomaly: Boolean(ev.timestampAnomaly),
        timestampAnomalyDetail: ev.timestampAnomalyDetail || undefined,
        uploadedBy: ev.uploadedBy || bodyJson.leadInvestigatorName || 'Cmdr. Arjun Verma',
        uploadedAt: ev.uploadedAt || nowIso,
        lastVerifiedAt: ev.lastVerifiedAt || nowIso,
      };
    });

    const rawRelationships: any[] = Array.isArray(bodyJson.relationships)
      ? bodyJson.relationships
      : existingBundle?.entities?.relationships || [];

    const relationships: any[] = rawRelationships
      .filter((r) => r.sourceEntityId && r.targetEntityId && r.sourceEntityId !== r.targetEntityId)
      .map((r, idx) => ({
        id: r.id || `rel-${caseId}-${idx + 1}`,
        caseId,
        sourceEntityId: r.sourceEntityId,
        targetEntityId: r.targetEntityId,
        relationshipType: r.relationshipType || 'TRANSFERRED_TO',
        label: r.label || r.relationshipType || 'TRANSFERRED_TO',
        weight: typeof r.weight === 'number' ? r.weight : 8.5,
        confidence: typeof r.confidence === 'number' ? r.confidence : 0.95,
        evidenceId: r.evidenceId || undefined,
        eventTimestamp: r.eventTimestamp || nowIso,
      }));

    // Auto-create TRANSFERRED_TO relationships from transactions when both endpoints map to entities
    transactions.forEach((tx, idx) => {
      if (tx.fromEntityId && tx.toEntityId && tx.fromEntityId !== tx.toEntityId) {
        const exists = relationships.some(
          (r) =>
            r.sourceEntityId === tx.fromEntityId &&
            r.targetEntityId === tx.toEntityId &&
            r.relationshipType === 'TRANSFERRED_TO'
        );
        if (!exists) {
          relationships.push({
            id: `rel-tx-${caseId}-${idx + 1}`,
            caseId,
            sourceEntityId: tx.fromEntityId,
            targetEntityId: tx.toEntityId,
            relationshipType: 'TRANSFERRED_TO',
            label: `TRANSFERRED_TO (${tx.currency} ${tx.amount.toLocaleString()})`,
            weight: 9.2,
            confidence: 0.98,
            evidenceId: tx.evidenceId,
            eventTimestamp: tx.timestamp,
          });
        }
      }
    });

    const rawTimeline: any[] = Array.isArray(bodyJson.timeline)
      ? bodyJson.timeline
      : existingBundle?.timeline?.timeline || [];

    const timeline: any[] = rawTimeline.map((tl, idx) => ({
      id: tl.id || `evt-${caseId}-${idx + 1}`,
      caseId,
      evidenceId: tl.evidenceId || evidence[0]?.id || undefined,
      evidenceCode: tl.evidenceCode || evidence[0]?.evidenceCode || `STEP-${idx + 1}`,
      eventTimestamp: tl.eventTimestamp ?? '',
      timestamp: tl.eventTimestamp ?? '',
      timestampSource: tl.timestampSource || 'INVESTIGATOR_RECORD',
      killChainPhase: tl.killChainPhase || 'INITIAL_CONTACT',
      severity: tl.severity || 'HIGH',
      title: tl.title || `Investigation Event ${idx + 1}`,
      description: tl.description || '',
      actorEntity: tl.actorEntity || '',
      targetEntity: tl.targetEntity || '',
      amountInvolved: tl.amountInvolved || '',
      linkedEntityIds: Array.isArray(tl.linkedEntityIds) ? tl.linkedEntityIds : [],
      anomalyFlag: Boolean(tl.anomalyFlag),
      anomalyReason: tl.anomalyReason || undefined,
      confidence: typeof tl.confidence === 'number' ? tl.confidence : 0.96,
    }));

    // Build Chain of Custody ledger entries
    const ledgerEntries: any[] = Array.isArray(existingBundle?.ledger?.ledger) && existingBundle.ledger.ledger.length > 0
      ? [...existingBundle.ledger.ledger]
      : [];

    if (ledgerEntries.length === 0) {
      const genesisHash = deterministicHex64(`genesis-${caseId}-${caseNumber}`);
      ledgerEntries.push({
        id: `led-${caseId}-1`,
        sequenceNumber: 1,
        caseId,
        actorUsername: bodyJson.leadInvestigatorId || 'arjun.verma',
        actorRole: 'LEAD_INVESTIGATOR',
        actionType: 'CASE_INITIALIZED',
        targetResource: `${caseNumber} (${bodyJson.title || 'Investigation'})`,
        details: `Initialized forensic case workspace ${caseNumber} with chain-of-custody tracking.`,
        clientIp: '10.24.0.12',
        previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
        entryHash: genesisHash,
        timestamp: nowIso,
        createdAt: nowIso,
      });

      evidence.forEach((ev, idx) => {
        const prev = ledgerEntries[ledgerEntries.length - 1];
        const entryHash = deterministicHex64(`${prev.entryHash}-${ev.sha256Hash}-${idx}`);
        ledgerEntries.push({
          id: `led-${caseId}-${ledgerEntries.length + 1}`,
          sequenceNumber: ledgerEntries.length + 1,
          caseId,
          actorUsername: ev.uploadedBy || 'arjun.verma',
          actorRole: 'LEAD_INVESTIGATOR',
          actionType: 'EVIDENCE_UPLOAD_SEALED',
          targetResource: `${ev.evidenceCode} (${ev.originalFilename})`,
          details: `Sealed ${ev.evidenceCode} with SHA-256 fingerprint ${ev.sha256Hash.slice(0, 16)}…`,
          clientIp: '10.24.0.12',
          previousHash: prev.entryHash,
          entryHash,
          timestamp: ev.uploadedAt || nowIso,
          createdAt: ev.uploadedAt || nowIso,
        });
      });
    }

    const verifications = evidence.map((ev, idx) => ({
      id: `ver-${caseId}-${idx + 1}`,
      caseId,
      evidenceId: ev.id,
      evidenceCode: ev.evidenceCode,
      evidenceFilename: ev.originalFilename,
      expectedSha256: ev.sha256Hash,
      computedSha256: ev.sha256Hash,
      expectedBlake3: ev.blake3Hash,
      computedBlake3: ev.blake3Hash,
      status: ev.integrityStatus === 'TAMPER_DETECTED' ? 'TAMPER_DETECTED' : 'VERIFIED_INTACT',
      verifiedBy: bodyJson.leadInvestigatorName || 'Cmdr. Arjun Verma',
      verifiedAt: nowIso,
      certificateSignature: deterministicHex64(`sig-${ev.sha256Hash}`).slice(0, 40),
    }));

    // Compute default estimatedLossUsd if not explicitly provided but USD/INR transactions exist
    let estimatedLossUsd =
      typeof bodyJson.estimatedLossUsd === 'number'
        ? bodyJson.estimatedLossUsd
        : parseFloat(String(bodyJson.estimatedLossUsd ?? existingCase?.estimatedLossUsd ?? '0')) || 0;

    if (estimatedLossUsd === 0 && transactions.length > 0) {
      const usdSum = transactions
        .filter((t) => t.currency === 'USD' || t.currency === 'USDT')
        .reduce((acc, t) => acc + (t.amount || 0), 0);
      const inrSum = transactions
        .filter((t) => t.currency === 'INR')
        .reduce((acc, t) => acc + (t.amount || 0), 0);
      if (usdSum > 0) {
        estimatedLossUsd = Math.round(usdSum);
      } else if (inrSum > 0) {
        estimatedLossUsd = Math.round(inrSum / 83.5);
      }
    }

    const updatedCase = {
      ...(existingCase || {}),
      id: caseId,
      caseNumber,
      title: bodyJson.title || existingCase?.title || 'New Digital Forensic Investigation',
      incidentType: bodyJson.incidentType || existingCase?.incidentType || 'UPI_MULE_PHISHING',
      status: bodyJson.status || existingCase?.status || 'OPEN',
      severity: bodyJson.severity || existingCase?.severity || 'HIGH',
      riskScore: typeof bodyJson.riskScore === 'number' ? bodyJson.riskScore : existingCase?.riskScore ?? 58,
      summary:
        bodyJson.summary ??
        bodyJson.description ??
        existingCase?.summary ??
        'Investigator-entered digital forensic case.',
      description:
        bodyJson.description ??
        bodyJson.summary ??
        existingCase?.description ??
        'Investigator-entered digital forensic case.',
      victimName: bodyJson.victimName ?? existingCase?.victimName ?? 'Not recorded',
      estimatedLossUsd,
      leadInvestigatorId: bodyJson.leadInvestigatorId || existingCase?.leadInvestigatorId || 'usr-lead-01',
      leadInvestigatorName:
        bodyJson.leadInvestigatorName || existingCase?.leadInvestigatorName || 'Cmdr. Arjun Verma',
      jurisdictionCountry: bodyJson.jurisdictionCountry ?? existingCase?.jurisdictionCountry ?? 'India',
      leadUnit: bodyJson.leadUnit ?? existingCase?.leadUnit ?? 'Financial Crimes & Digital Forensics Unit',
      transactions,
      caseOrigin: isPreloaded ? 'PRELOADED' : 'USER_CREATED',
      createdAt: existingCase?.createdAt || bodyJson.createdAt || nowIso,
      updatedAt: nowIso,
      evidenceCount: evidence.length,
      entityCount: entities.length,
      relationshipCount: relationships.length,
      timelineEventCount: timeline.length,
      verifiedIntactCount: evidence.filter((e) => e.integrityStatus === 'VERIFIED_INTACT').length,
      tamperedCount: evidence.filter((e) => e.integrityStatus === 'TAMPER_DETECTED').length,
      metadataAnomalyCount: 0,
      riskIndicators: existingCase?.riskIndicators || [],
    };

    const updatedBundle = {
      ...(existingBundle || {}),
      evidence: { caseId, count: evidence.length, evidence },
      entities: { caseId, entities, relationships },
      graph: { caseId, nodes: [], edges: [] },
      timeline: {
        caseId,
        anomalyCount: timeline.filter((t) => t.anomalyFlag).length,
        count: timeline.length,
        timeline,
        events: timeline,
        anomalies: timeline.filter((t) => t.anomalyFlag),
      },
      verifications: { caseId, verifications },
      ledger: {
        caseId,
        ledger: ledgerEntries,
        chainVerification: {
          chainIntact: true,
          totalEntriesVerified: ledgerEntries.length,
          headMerkleHash: ledgerEntries[ledgerEntries.length - 1]?.entryHash || '00000000',
          verifiedAt: nowIso,
        },
      },
    };

    recomputeCaseDerivedMetrics(updatedCase, updatedBundle);
    return { updatedCase, updatedBundle };
  }

  async function handleFallbackRequest(input: string, init?: RequestInit): Promise<Response> {
    enableDomInterceptors();
    const url = new URL(input, window.location.origin);
    const path = url.pathname;
    const method = (init?.method || 'GET').toUpperCase();
    const bodyText = typeof init?.body === 'string' ? init.body : '';
    const bodyJson: Record<string, any> = bodyText ? safeParseJson(bodyText) : {};
    let uploadedFile: any = null;

    if (typeof FormData !== 'undefined' && init?.body instanceof FormData) {
      init.body.forEach((val, key) => {
        if (typeof File !== 'undefined' && val instanceof File) {
          uploadedFile = val;
        } else {
          bodyJson[key] = String(val);
        }
      });
    }

    if (path === '/api/v1/auth/demo-users') {
      return jsonResp(state.demoUsersResponse);
    }
    if (path === '/api/v1/auth/users') {
      return jsonResp(state.usersResponse);
    }
    if (path === '/api/v1/auth/login' && method === 'POST') {
      const uname = (bodyJson.username || '').trim();
      const pwd = (bodyJson.password || '').trim();
      if (!uname || !pwd) {
        return jsonResp({ error: 'Username and password are required.' }, 400);
      }
      const users = state.usersResponse?.users || [];
      const found = users.find((u: any) => u.username === uname);
      if (!found) {
        return jsonResp({ error: 'Invalid investigator username or password' }, 401);
      }
      return jsonResp({
        authenticated: true,
        token: `demo-jwt-${found.username}-${Date.now()}`,
        user: found,
      });
    }
    if (path === '/api/v1/auth/switch-role' && method === 'POST') {
      const uname = bodyJson.username;
      const users = state.usersResponse?.users || [];
      const found = users.find((u: any) => u.username === uname);
      if (!found) {
        return jsonResp({ error: `Investigator account not found: ${uname}` }, 404);
      }
      return jsonResp({
        authenticated: true,
        token: `demo-jwt-${found.username}-${Date.now()}`,
        user: found,
      });
    }
    if (path === '/api/v1/auth/register' && method === 'POST') {
      const newUser = {
        id: `usr-${Date.now().toString(16).slice(-6)}`,
        username: bodyJson.username || 'investigator.new',
        fullName: bodyJson.fullName || 'Special Forensic Investigator',
        email: bodyJson.email || 'investigator@cyberfusion.gov',
        role: bodyJson.role || 'LEAD_INVESTIGATOR',
        department: bodyJson.department || 'Digital Forensics Unit',
        clearanceBadge: `CFX-BADGE-${Math.floor(1000 + Math.random() * 9000)}`,
      };
      state.usersResponse.users.push(newUser);
      await savePersistedWorkspaceState(state);
      return jsonResp(
        {
          authenticated: true,
          token: `demo-jwt-${newUser.username}-${Date.now()}`,
          user: newUser,
        },
        201
      );
    }
    if (path === '/api/v1/auth/logout') {
      return jsonResp({ status: 'LOGGED_OUT' });
    }
    if (path === '/api/v1/cases/reset-demo' && method === 'POST') {
      await clearPersistedWorkspaceState();
      state = cloneSeed();
      return jsonResp({ status: 'RESET_COMPLETE', cases: state.cases });
    }
    if (path === '/api/v1/cases' && method === 'GET') {
      return jsonResp({ cases: state.cases });
    }
    if (path === '/api/v1/cases' && method === 'POST') {
      const newId = bodyJson.id || `case-custom-${Date.now().toString(16).slice(-6)}`;
      const requestedCaseNumber = (bodyJson.caseNumber || '').trim();
      const caseNumber =
        requestedCaseNumber ||
        `CFX-2026-${Math.floor(1000 + Math.random() * 8999)}`;

      if (state.cases.some((c: any) => c.caseNumber.toLowerCase() === caseNumber.toLowerCase())) {
        return jsonResp({ error: `Case ID ${caseNumber} already exists in this workspace.` }, 409);
      }

      const { updatedCase, updatedBundle } = hydrateStructuredCasePayload(
        newId,
        caseNumber,
        bodyJson
      );
      state.cases.unshift(updatedCase);
      state.byCase[newId] = updatedBundle;
      await savePersistedWorkspaceState(state);
      return jsonResp({ ...updatedCase, case: updatedCase }, 201);
    }
    if (path.startsWith('/api/v1/cases/') && (method === 'PUT' || method === 'PATCH')) {
      const targetId = decodeURIComponent(path.replace('/api/v1/cases/', '').split('/')[0]);
      const existingIdx = state.cases.findIndex((c: any) => c.id === targetId);
      if (existingIdx < 0) {
        return jsonResp({ error: 'Case not found' }, 404);
      }
      const existingCase = state.cases[existingIdx];
      const existingBundle = state.byCase[targetId];
      const requestedCaseNumber = (bodyJson.caseNumber || existingCase.caseNumber).trim();

      if (
        state.cases.some(
          (c: any, idx: number) =>
            idx !== existingIdx && c.caseNumber.toLowerCase() === requestedCaseNumber.toLowerCase()
        )
      ) {
        return jsonResp({ error: `Case ID ${requestedCaseNumber} is already in use.` }, 409);
      }

      const { updatedCase, updatedBundle } = hydrateStructuredCasePayload(
        targetId,
        requestedCaseNumber,
        bodyJson,
        existingCase,
        existingBundle
      );
      state.cases[existingIdx] = updatedCase;
      state.byCase[targetId] = updatedBundle;
      await savePersistedWorkspaceState(state);
      return jsonResp({ ...updatedCase, case: updatedCase });
    }
    if (path.startsWith('/api/v1/cases/') && method === 'DELETE') {
      const targetId = decodeURIComponent(path.replace('/api/v1/cases/', '').split('/')[0]);
      const existingIdx = state.cases.findIndex((c: any) => c.id === targetId);
      if (existingIdx < 0) {
        return jsonResp({ error: 'Case not found' }, 404);
      }
      if (state.cases.length <= 1) {
        return jsonResp({ error: 'Cannot delete the last remaining case in the workspace.' }, 400);
      }
      state.cases.splice(existingIdx, 1);
      delete state.byCase[targetId];
      await savePersistedWorkspaceState(state);
      return jsonResp({ status: 'DELETED', deletedCaseId: targetId, cases: state.cases });
    }
    if (path.endsWith('/reanalyze') && method === 'POST') {
      const targetCaseId =
        url.searchParams.get('caseId') ||
        bodyJson.caseId ||
        path.split('/')[4] ||
        state.cases[0]?.id;
      const targetSummary = state.cases.find((c: any) => c.id === targetCaseId);
      const targetBundle = state.byCase[targetCaseId];
      if (targetSummary && targetBundle) {
        recomputeCaseDerivedMetrics(targetSummary, targetBundle);
        await savePersistedWorkspaceState(state);
      }
      return jsonResp({ status: 'REANALYZED', cases: state.cases });
    }

    const caseId =
      url.searchParams.get('caseId') ||
      bodyJson.caseId ||
      'case-phantom-upi-01';
    const bundle =
      state.byCase[caseId] || state.byCase['case-phantom-upi-01'];

    if (path === '/api/v1/evidence' && method === 'GET') {
      return jsonResp(bundle.evidence);
    }
    if (
      (path === '/api/v1/evidence/upload' ||
        path === '/api/v1/evidence/quick-artifact' ||
        path === '/api/v1/evidence') &&
      method === 'POST'
    ) {
      const evList = bundle.evidence.evidence;
      const nextCode = `EVD-${String(evList.length + 1).padStart(3, '0')}`;
      const newId = `evd-${Date.now().toString(16).slice(-8)}`;
      const uploadedAtIso = new Date().toISOString();

      let fileTextContent = '';
      if (uploadedFile && !uploadedFile.type.startsWith('image/')) {
        try {
          fileTextContent = (await uploadedFile.text()).slice(0, 1200);
        } catch {
          fileTextContent = '';
        }
      }

      const contentStr =
        bodyJson.content ||
        fileTextContent ||
        (uploadedFile
          ? `File: ${uploadedFile.name}\nCategory: ${bodyJson.category || 'SCREENSHOT'}\nIngested: ${uploadedAtIso}\nNotes: ${bodyJson.notes || 'Verified forensic upload'}\nSHA-256: ${bodyJson.clientSha256 || '3bbc2d1628c8c083a630db744485e61ac7ae3cbfcf3ea90459dfbaa761384ce1'}`
          : 'Sender: +919820411892\nTimestamp: 2026-10-01T10:52:10Z\nFrom UPI: fast.liquidity.hub@ybl\nSettlement Reference: UTR992018472610');

      const lines = contentStr.split(/\r?\n/).filter(Boolean).slice(0, 10);
      const effectiveCategory = bodyJson.category || 'TRANSACTION_RECEIPT';
      const effectiveFilename =
        uploadedFile?.name || `${nextCode.toLowerCase()}_artifact.png`;
      const effectiveTitle =
        bodyJson.title || uploadedFile?.name || 'Synthesized Forensic Evidence';

      let dataUrl = '';
      if (uploadedFile && uploadedFile.type.startsWith('image/')) {
        dataUrl = await readFileAsDataUrl(uploadedFile);
      }
      if (!dataUrl) {
        dataUrl = renderSyntheticEvidenceDataUrl(
          nextCode,
          effectiveTitle,
          effectiveCategory,
          lines
        );
      }
      state.customImages[newId] = dataUrl;

      const sha256Hash =
        bodyJson.clientSha256 ||
        '9a3f2b18c4e5d6a7890123456789abcdef0123456789abcdef0123456789abcd';
      const blake3Hash =
        '7e4d1c09b8a2f3e4567890123456789abcdef0123456789abcdef01234567890';

      const boundingBoxes = lines.map((line: string, idx: number) => {
        const entityType = line.includes('@')
          ? 'UPI_ID'
          : line.includes('+')
          ? 'PHONE'
          : line.includes('UTR')
          ? 'TRANSACTION_ID'
          : line.includes('http')
          ? 'URL'
          : 'TEXT_LINE';
        return {
          id: `bbox-${newId}-${idx + 1}`,
          blockId: `BLK-${idx + 1}`,
          text: line,
          x: 44,
          y: 144 + idx * 64,
          width: 632,
          height: 42,
          confidence: 0.984,
          entityType,
          detectedTag: entityType,
        };
      });

      const newEv = {
        ...(evList[0] || {}),
        id: newId,
        caseId,
        evidenceCode: nextCode,
        title: effectiveTitle,
        category: effectiveCategory,
        evidenceCategory: effectiveCategory,
        originalFilename: effectiveFilename,
        originalFileName: effectiveFilename,
        detectedMimeType: uploadedFile?.type || 'image/png',
        fileSizeBytes: uploadedFile?.size || 42810,
        storagePath: `/home/user/CyberFusion-X/data/vault/${newId}_${effectiveFilename}`,
        sha256Hash,
        blake3Hash,
        clientProvidedSha256: sha256Hash,
        transitVerified: true,
        ocrRawText: contentStr,
        extractedText: contentStr,
        ocrConfidence: 0.984,
        tamperedFlag: false,
        integrityStatus: 'VERIFIED_INTACT',
        timestampAnomaly: false,
        uploadedBy: 'Sarah Chen (Lead Investigator)',
        uploadedAt: uploadedAtIso,
        lastVerifiedAt: uploadedAtIso,
        exifMetadata: {
          FileName: effectiveFilename,
          DetectedMimeType: uploadedFile?.type || 'image/png',
          FileSizeBytes: String(uploadedFile?.size || 42810),
          ForensicIngestTimestampUTC: uploadedAtIso,
          Notes: bodyJson.notes || 'WORM Vault Sealed on Upload',
        },
        boundingBoxes,
        ocrBlocks: boundingBoxes,
      };
      evList.push(newEv);

      const caseSummary = state.cases.find((c: any) => c.id === caseId);

      if (bundle.ledger?.ledger && Array.isArray(bundle.ledger.ledger)) {
        const prevEntry = bundle.ledger.ledger[bundle.ledger.ledger.length - 1];
        bundle.ledger.ledger.push({
          id: `led-${Date.now().toString(16).slice(-6)}`,
          sequenceNumber: (prevEntry?.sequenceNumber || bundle.ledger.ledger.length) + 1,
          caseId,
          actorUsername: 'arjun.verma',
          actorRole: 'LEAD_INVESTIGATOR',
          actionType: 'EVIDENCE_UPLOAD_SEALED',
          targetResource: `${nextCode} (${effectiveFilename})`,
          details: `Uploaded and sealed ${nextCode} (${effectiveFilename}) with verified SHA-256 fingerprint.`,
          previousHash: prevEntry?.entryHash || '0000000000000000',
          entryHash: sha256Hash,
          hmacSignature: blake3Hash.slice(0, 32),
          timestamp: uploadedAtIso,
          createdAt: uploadedAtIso,
        });
      }

      if (caseSummary) {
        recomputeCaseDerivedMetrics(caseSummary, bundle);
      }
      await savePersistedWorkspaceState(state);

      return jsonResp({ evidence: newEv }, 201);
    }
    if (path === '/api/v1/entities' && method === 'GET') {
      return jsonResp(bundle.entities);
    }
    if (path === '/api/v1/entities/relationship' && method === 'POST') {
      const newRel = {
        id: `rel-${Date.now().toString(16).slice(-6)}`,
        caseId,
        sourceEntityId: bodyJson.sourceEntityId,
        targetEntityId: bodyJson.targetEntityId,
        relationshipType: bodyJson.relationshipType || 'TRANSFERRED_TO',
        label: bodyJson.label || bodyJson.relationshipType || 'TRANSFERRED_TO',
        weight: 8.5,
        evidenceIds: [],
        timestamp: new Date().toISOString(),
      };
      bundle.entities.relationships.push(newRel);
      const caseSummary = state.cases.find((c: any) => c.id === caseId);
      if (caseSummary) {
        recomputeCaseDerivedMetrics(caseSummary, bundle);
      } else {
        bundle.graph.edges.push({
          id: newRel.id,
          source: newRel.sourceEntityId,
          target: newRel.targetEntityId,
          type: newRel.relationshipType,
          label: newRel.label,
          weight: newRel.weight,
          evidenceIds: [],
        });
      }
      await savePersistedWorkspaceState(state);
      return jsonResp({ relationship: newRel }, 201);
    }
    if (path === '/api/v1/entities/merge' && method === 'POST') {
      const primaryId = bodyJson.primaryEntityId;
      const dupId = bodyJson.secondaryEntityId || bodyJson.duplicateEntityId;
      const primary = bundle.entities.entities.find(
        (e: any) => e.id === primaryId
      );
      bundle.entities.entities = bundle.entities.entities.filter(
        (e: any) => e.id !== dupId
      );
      bundle.entities.relationships = (bundle.entities.relationships || [])
        .map((r: any) => ({
          ...r,
          sourceEntityId: r.sourceEntityId === dupId ? primaryId : r.sourceEntityId,
          targetEntityId: r.targetEntityId === dupId ? primaryId : r.targetEntityId,
        }))
        .filter((r: any) => r.sourceEntityId !== r.targetEntityId);
      const caseSummary = state.cases.find((c: any) => c.id === caseId);
      if (caseSummary) {
        recomputeCaseDerivedMetrics(caseSummary, bundle);
      }
      await savePersistedWorkspaceState(state);
      return jsonResp({ mergedEntity: primary || { id: primaryId } });
    }
    if (path === '/api/v1/graph' && method === 'GET') {
      return jsonResp(bundle.graph);
    }
    if (path === '/api/v1/graph/shortest-path' && method === 'GET') {
      const sourceId = url.searchParams.get('sourceId') || '';
      const targetId = url.searchParams.get('targetId') || '';
      const sp = computeShortestPath(bundle.graph, sourceId, targetId);
      return jsonResp(sp);
    }
    if (path === '/api/v1/timeline' && method === 'GET') {
      return jsonResp(bundle.timeline);
    }
    if (path === '/api/v1/timeline' && method === 'POST') {
      const nowIso = bodyJson.eventTimestamp || new Date().toISOString();
      const newEvt = {
        id: `evt-${Date.now().toString(16).slice(-6)}`,
        caseId,
        evidenceId: bodyJson.evidenceId || 'MANUAL_ENTRY',
        evidenceCode: bodyJson.evidenceCode || 'ANALYST',
        eventTimestamp: nowIso,
        timestamp: nowIso,
        timestampSource: bodyJson.timestampSource || 'ANALYST_NOTE',
        killChainPhase: bodyJson.killChainPhase || 'CASH_OUT_EXIT',
        title: bodyJson.title || 'Investigator Milestone',
        description: bodyJson.description || '',
        actorEntity: bodyJson.actorEntity || 'Investigator Note',
        targetEntity: bodyJson.targetEntity || 'Case Timeline',
        amountInvolved: bodyJson.amountInvolved || null,
        linkedEntityIds: Array.isArray(bodyJson.linkedEntityIds) ? bodyJson.linkedEntityIds : [],
        sourceEvidenceId: bodyJson.evidenceId || 'MANUAL_ENTRY',
        sourceEvidenceCode: bodyJson.evidenceCode || 'ANALYST',
        involvedEntityIds: Array.isArray(bodyJson.linkedEntityIds) ? bodyJson.linkedEntityIds : [],
        anomalyFlag: Boolean(bodyJson.anomalyFlag),
        anomalyReason: bodyJson.anomalyReason || null,
        timestampDiscrepancyFlag: Boolean(bodyJson.anomalyFlag),
        discrepancyReason: bodyJson.anomalyReason || 'Verified manual investigator entry',
        severity: bodyJson.severity || 'HIGH',
        confidence: 1.0,
      };
      if (Array.isArray(bundle.timeline.timeline)) {
        bundle.timeline.timeline.push(newEvt);
      }
      const caseSummary = state.cases.find((c: any) => c.id === caseId);
      if (caseSummary) {
        recomputeCaseDerivedMetrics(caseSummary, bundle);
      }
      await savePersistedWorkspaceState(state);
      return jsonResp({ event: newEvt }, 201);
    }
    if (path === '/api/v1/integrity/verifications' && method === 'GET') {
      return jsonResp(bundle.verifications || { verifications: [] });
    }
    if (path === '/api/v1/integrity/ledger' && method === 'GET') {
      return jsonResp(bundle.ledger);
    }
    if (path === '/api/v1/integrity/verify' && method === 'POST') {
      const evId = bodyJson.evidenceId;
      const ev = bundle.evidence.evidence.find((e: any) => e.id === evId);
      const intact = !ev?.tamperedFlag;
      return jsonResp({
        verification: {
          evidenceId: evId,
          evidenceCode: ev?.evidenceCode || 'EVD-001',
          status: intact ? 'VERIFIED_INTACT' : 'TAMPER_DETECTED',
          intact,
        },
      });
    }
    if (path === '/api/v1/integrity/simulate-tamper' && method === 'POST') {
      const evId = bodyJson.evidenceId;
      const tamper =
        bodyJson.tamper === true || String(bodyJson.tamper) === 'true';
      const ev = bundle.evidence.evidence.find((e: any) => e.id === evId);
      if (ev) {
        ev.tamperedFlag = tamper;
        ev.integrityStatus = tamper ? 'TAMPER_DETECTED' : 'VERIFIED_INTACT';
      }
      const caseSummary = state.cases.find((c: any) => c.id === caseId);
      if (caseSummary) {
        recomputeCaseDerivedMetrics(caseSummary, bundle);
      }
      await savePersistedWorkspaceState(state);
      return jsonResp({
        verification: {
          evidenceId: evId,
          evidenceCode: ev?.evidenceCode || 'EVD-001',
          status: tamper ? 'TAMPER_DETECTED' : 'VERIFIED_INTACT',
          intact: !tamper,
          expectedSha256: ev?.sha256Hash || '',
          computedSha256: tamper
            ? 'f9bad00019c48a109e22411892ff01a8c0019283746554112233445566778899'
            : ev?.sha256Hash || '',
          expectedBlake3: ev?.blake3Hash || '',
          computedBlake3: tamper
            ? 'e000tampered9981726354123891029384756102938475610293847561029384'
            : ev?.blake3Hash || '',
        },
      });
    }
    if (path === '/api/v1/integrity/verify-case' && method === 'POST') {
      return jsonResp({ status: 'CASE_VERIFIED' });
    }
    if (path === '/api/v1/reports' && method === 'GET') {
      const caseSummary =
        state.cases.find((c: any) => c.id === caseId) || state.cases[0];
      const model = buildReportModel({
        activeCase: caseSummary,
        evidenceList: bundle.evidence?.evidence || [],
        entities: bundle.entities?.entities || [],
        relationships: bundle.entities?.relationships || [],
        timeline: bundle.timeline?.timeline || [],
        verifications: bundle.verifications?.verifications || [],
        ledger: bundle.ledger?.ledger || [],
        chainVerification: bundle.ledger?.chainVerification || null,
      });
      return jsonResp({
        ...bundle.report,
        reportModel: model,
        markdownPreview: generateReportMarkdown(model),
      });
    }
    if (path === '/api/v1/reports/stix' && method === 'GET') {
      const caseSummary =
        state.cases.find((c: any) => c.id === caseId) || state.cases[0];
      const model = buildReportModel({
        activeCase: caseSummary,
        evidenceList: bundle.evidence?.evidence || [],
        entities: bundle.entities?.entities || [],
        relationships: bundle.entities?.relationships || [],
        timeline: bundle.timeline?.timeline || [],
        verifications: bundle.verifications?.verifications || [],
        ledger: bundle.ledger?.ledger || [],
        chainVerification: bundle.ledger?.chainVerification || null,
      });
      return jsonResp(model);
    }
    if (path === '/api/v1/reports/markdown' && method === 'GET') {
      const caseSummary =
        state.cases.find((c: any) => c.id === caseId) || state.cases[0];
      const model = buildReportModel({
        activeCase: caseSummary,
        evidenceList: bundle.evidence?.evidence || [],
        entities: bundle.entities?.entities || [],
        relationships: bundle.entities?.relationships || [],
        timeline: bundle.timeline?.timeline || [],
        verifications: bundle.verifications?.verifications || [],
        ledger: bundle.ledger?.ledger || [],
        chainVerification: bundle.ledger?.chainVerification || null,
      });
      return new Response(generateReportMarkdown(model), {
        status: 200,
        headers: { 'Content-Type': 'text/markdown;charset=utf-8' },
      });
    }
    if (path === '/api/v1/reports/pdf' && method === 'GET') {
      const caseSummary =
        state.cases.find((c: any) => c.id === caseId) || state.cases[0];
      const model = buildReportModel({
        activeCase: caseSummary,
        evidenceList: bundle.evidence?.evidence || [],
        entities: bundle.entities?.entities || [],
        relationships: bundle.entities?.relationships || [],
        timeline: bundle.timeline?.timeline || [],
        verifications: bundle.verifications?.verifications || [],
        ledger: bundle.ledger?.ledger || [],
        chainVerification: bundle.ledger?.chainVerification || null,
      });
      const result = await generateReportPdfBytes(model);
      return new Response(result.bytes as unknown as BodyInit, {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      });
    }
    if (path === '/api/v1/search' && method === 'GET') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const entities = bundle.entities.entities.filter(
        (e: any) =>
          e.displayLabel.toLowerCase().includes(q) ||
          e.normalizedValue.toLowerCase().includes(q)
      );
      const evidence = bundle.evidence.evidence.filter(
        (ev: any) =>
          ev.title.toLowerCase().includes(q) ||
          ev.extractedText.toLowerCase().includes(q)
      );
      return jsonResp({ query: q, entities, evidence, timelineEvents: [] });
    }

    return jsonResp({ status: 'OK' });
  }

  function computeShortestPath(
    graph: any,
    sourceId: string,
    targetId: string
  ) {
    const edges = graph?.edges || [];
    const adj: Record<string, { to: string; edgeId: string; w: number }[]> = {};
    edges.forEach((e: any) => {
      adj[e.source] = adj[e.source] || [];
      adj[e.target] = adj[e.target] || [];
      adj[e.source].push({ to: e.target, edgeId: e.id, w: 2.95 });
      adj[e.target].push({ to: e.source, edgeId: e.id, w: 2.95 });
    });
    const q: { node: string; nodes: string[]; edges: string[]; w: number }[] = [
      { node: sourceId, nodes: [sourceId], edges: [], w: 0 },
    ];
    const visited = new Set<string>([sourceId]);
    while (q.length > 0) {
      const cur = q.shift()!;
      if (cur.node === targetId) {
        return {
          pathFound: true,
          sourceId,
          targetId,
          hopCount: cur.edges.length,
          nodeIds: cur.nodes,
          edgeIds: cur.edges,
          totalWeight: Number(cur.w.toFixed(2)),
        };
      }
      for (const nxt of adj[cur.node] || []) {
        if (!visited.has(nxt.to)) {
          visited.add(nxt.to);
          q.push({
            node: nxt.to,
            nodes: [...cur.nodes, nxt.to],
            edges: [...cur.edges, nxt.edgeId],
            w: cur.w + nxt.w,
          });
        }
      }
    }
    return {
      pathFound: false,
      sourceId,
      targetId,
      hopCount: 0,
      nodeIds: [],
      edgeIds: [],
      totalWeight: 0,
    };
  }

  function safeParseJson(str: string) {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const urlStr =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    if (!urlStr.includes('/api/v1/')) {
      return nativeFetch(input, init);
    }

    if (standaloneModeActive) {
      return handleFallbackRequest(urlStr, init);
    }

    try {
      const res = await nativeFetch(input, init);
      const ct = res.headers.get('content-type') || '';
      if (
        res.status === 404 ||
        res.status === 405 ||
        res.status >= 502 ||
        (!ct.includes('application/json') &&
          !urlStr.includes('/raw') &&
          !urlStr.includes('/reports/'))
      ) {
        return handleFallbackRequest(urlStr, init);
      }
      return res;
    } catch {
      return handleFallbackRequest(urlStr, init);
    }
  };
}
