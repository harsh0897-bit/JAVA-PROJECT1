import {
  ForensicCaseSummary,
  EvidenceItem,
  ExtractedEntity,
  EntityRelationship,
  TimelineEvent,
  IntegrityVerification,
  ChainOfCustodyEntry,
  UserProfile,
} from '../types';

export interface ReportInputState {
  activeCase: ForensicCaseSummary | null | undefined;
  evidenceList?: EvidenceItem[];
  entities?: ExtractedEntity[];
  relationships?: EntityRelationship[];
  timeline?: TimelineEvent[];
  verifications?: IntegrityVerification[];
  ledger?: ChainOfCustodyEntry[];
  chainVerification?: {
    chainIntact?: boolean;
    totalEntriesVerified?: number;
    headMerkleHash?: string;
    verifiedAt?: string;
  } | null;
  currentUser?: UserProfile | null;
  generatedAt?: Date;
}

export interface ReportTimelineRow {
  stepNumber: number;
  id: string;
  recordedTimestamp: string;
  timestampDisplay: string;
  timezoneNote: string;
  eventTitle: string;
  description: string;
  killChainPhase: string;
  involvedParties: string;
  amountRecorded: string;
  linkedEvidenceCode: string;
  warningOrStatus: string;
  hasWarning: boolean;
}

export interface ReportEvidenceRow {
  evidenceCode: string;
  id: string;
  filename: string;
  categoryAndMime: string;
  sizeBytes: number;
  sizeFormatted: string;
  sha256Fingerprint: string;
  blake3Fingerprint: string;
  acquisitionSource: string;
  uploadedAt: string;
  verificationStatus: string;
  timestampAnomaly: boolean;
  timestampAnomalyDetail: string;
}

export interface ReportEntityRow {
  id: string;
  displayLabel: string;
  entityType: string;
  plainCategory: string;
  normalizedValue: string;
  roleInIncident: string;
  riskLevel: string;
  confidencePct: string;
  linkedEvidenceCount: number;
  relationshipSummaries: string[];
}

export interface ReportRelationshipRow {
  id: string;
  sourceLabel: string;
  relationshipType: string;
  targetLabel: string;
  weight: number;
  evidenceRef: string;
}

export interface ReportFinancialMovement {
  recordId: string;
  sourceType: 'TIMELINE_EVENT' | 'EVIDENCE_ARTIFACT' | 'FINANCIAL_TRANSACTION';
  referenceCode: string;
  timestamp: string;
  rawAmountText: string;
  parsedAmount: number | null;
  currency: string;
  transactionId: string | null;
  fromParty: string;
  toParty: string;
  deduplicationNote: string;
}

export interface ReportCurrencySubtotal {
  currency: string;
  subtotalAmount: number;
  formattedSubtotal: string;
  recordCount: number;
  unresolvedDuplicateCount: number;
}

export interface ReportWarningItem {
  id: string;
  sourceRef: string;
  category: string;
  severity: string;
  whatWasFound: string;
  whyItMatters: string;
}

export interface ForensicReportModel {
  metadata: {
    schemaVersion: string;
    reportTitle: string;
    caseId: string;
    caseNumber: string;
    caseName: string;
    generatedAtUtc: string;
    generatedAtLocal: string;
    localTimezone: string;
    reportStatus: string;
    dataSourceClassification: string;
    dataSourceNote: string;
    preparedBy: string;
    nonLatinSubstitutionsApplied: number;
  };
  summary: {
    whatHappened: string;
    principalRisk: string;
    knownExposure: string;
    supportedConclusion: string;
  };
  metrics: {
    caseNumber: string;
    caseTitle: string;
    incidentType: string;
    status: string;
    severity: string;
    riskScore: string;
    victimName: string;
    leadInvestigator: string;
    recordedCaseLossUsd: string;
    evidenceFileCount: number;
    verifiedIntactFileCount: number;
    tamperedFileCount: number;
    correlatedEntityCount: number;
    relationshipEdgeCount: number;
    timelineStepCount: number;
    warningAndAnomalyCount: number;
  };
  timeline: ReportTimelineRow[];
  evidence: ReportEvidenceRow[];
  entities: ReportEntityRow[];
  relationships: ReportRelationshipRow[];
  financialSummary: {
    recordedCaseHeadlineExposure: string;
    movements: ReportFinancialMovement[];
    currencySubtotals: ReportCurrencySubtotal[];
    deduplicationPolicyNote: string;
  };
  warnings: ReportWarningItem[];
  integrity: {
    scopeSummary: string;
    verifiedIntactCount: number;
    tamperedCount: number;
    unverifiedCount: number;
    totalEvidenceCount: number;
    merkleChainStatus: string;
    headMerkleHash: string;
    presentationDisclaimer: string;
    custodyEntries: Array<{
      sequenceNumber: number;
      timestamp: string;
      actor: string;
      role: string;
      actionType: string;
      targetResource: string;
      details: string;
      entryHash: string;
    }>;
  };
  conclusion: {
    summaryStatement: string;
    nextReviewPoints: string[];
  };
  glossary: Array<{
    term: string;
    definition: string;
  }>;
}

export function formatBytesReadable(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes) || bytes < 0) {
    return 'Not recorded';
  }
  if (bytes === 0) return '0 B (0 bytes)';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i]} (${bytes.toLocaleString('en-US')} bytes)`;
}

function detectTimestampInfo(raw?: string | null): {
  sortKey: number | null;
  display: string;
  timezoneNote: string;
} {
  if (!raw || !raw.trim()) {
    return {
      sortKey: null,
      display: 'Date not recorded',
      timezoneNote: 'No timestamp recorded',
    };
  }
  const trimmed = raw.trim();
  const hasExplicitTz = /Z$|[+-]\d{2}:?\d{2}$/i.test(trimmed);
  const parsedMs = Date.parse(trimmed);
  if (Number.isNaN(parsedMs)) {
    return {
      sortKey: null,
      display: trimmed,
      timezoneNote: hasExplicitTz
        ? 'Recorded with timezone'
        : 'Timezone not specified in source (shown as recorded)',
    };
  }
  return {
    sortKey: parsedMs,
    display: hasExplicitTz ? trimmed : `${trimmed} (timezone not specified in source)`,
    timezoneNote: hasExplicitTz
      ? trimmed.endsWith('Z') || trimmed.endsWith('z')
        ? 'UTC (explicit Z in source)'
        : 'Explicit offset in source'
      : 'Timezone not specified in source (not converted)',
  };
}

function getPlainEntityCategory(entityType?: string): string {
  switch ((entityType || '').toUpperCase()) {
    case 'PERSON':
      return 'Person';
    case 'PHONE':
      return 'Phone number';
    case 'BANK_ACCOUNT':
      return 'Bank account';
    case 'UPI_ID':
      return 'Payment ID (UPI)';
    case 'CRYPTO_WALLET':
      return 'Cryptocurrency wallet';
    case 'URL':
    case 'DOMAIN':
      return 'Website / domain link';
    case 'IP_ADDRESS':
      return 'Server IP address';
    case 'EMAIL':
      return 'Email address';
    case 'TRANSACTION_ID':
      return 'Transaction reference';
    case 'MALWARE_HASH':
      return 'File / malware indicator';
    default:
      return entityType ? entityType.replace(/_/g, ' ') : 'Not recorded';
  }
}

function extractTransactionId(text: string): string | null {
  if (!text) return null;
  const match = text.match(
    /\b(UTR[-:]?\d{6,18}|IMPS[-:]?\d{6,18}|SWIFT[-:]?[A-Z0-9-]{6,22}|TXN[-:]?[A-Z0-9-]{5,22})\b/i
  );
  return match ? match[1].toUpperCase().replace(/:/g, '-') : null;
}

function parseCurrencyAndAmount(rawText?: string | null): {
  currency: string;
  amount: number | null;
} | null {
  if (!rawText || !rawText.trim()) return null;
  const text = rawText.trim();

  // Check for explicit currency symbols/codes
  let currency = 'UNSPECIFIED';
  if (/USDT/i.test(text)) {
    currency = 'USDT';
  } else if (/₹|\bINR\b|\bRs\.?\b/i.test(text)) {
    currency = 'INR';
  } else if (/\$|\bUSD\b/i.test(text)) {
    currency = 'USD';
  } else if (/€|\bEUR\b/i.test(text)) {
    currency = 'EUR';
  } else if (/£|\bGBP\b/i.test(text)) {
    currency = 'GBP';
  }

  // Extract first monetary number (supporting commas and decimals)
  const numMatch = text.match(/(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/);
  if (!numMatch) {
    return { currency, amount: null };
  }
  const cleanNum = parseFloat(numMatch[1].replace(/,/g, ''));
  return {
    currency,
    amount: Number.isFinite(cleanNum) ? cleanNum : null,
  };
}

function formatCurrencyValue(amount: number, currency: string): string {
  const formattedNum = amount.toLocaleString('en-US', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  switch (currency) {
    case 'USD':
      return `$${formattedNum} USD`;
    case 'INR':
      return `INR ${formattedNum}`;
    case 'USDT':
      return `${formattedNum} USDT`;
    case 'EUR':
      return `EUR ${formattedNum}`;
    case 'GBP':
      return `GBP ${formattedNum}`;
    default:
      return `${formattedNum} (${currency})`;
  }
}

/**
 * Pure deterministic function that constructs the complete 10-section ForensicReportModel
 * from the active case state in memory. All export formats (PDF, JSON, Markdown, CSV)
 * read exclusively from this model so they can never disagree.
 */
export function buildReportModel(state: ReportInputState): ForensicReportModel {
  const now = state.generatedAt instanceof Date ? state.generatedAt : new Date();
  const generatedAtUtc = now.toISOString();

  const tzName =
    (typeof Intl !== 'undefined' &&
      Intl.DateTimeFormat().resolvedOptions().timeZone) ||
    'Local Time';
  const tzOffsetMin = -now.getTimezoneOffset();
  const tzSign = tzOffsetMin >= 0 ? '+' : '-';
  const tzAbsMin = Math.abs(tzOffsetMin);
  const tzHours = String(Math.floor(tzAbsMin / 60)).padStart(2, '0');
  const tzMins = String(tzAbsMin % 60).padStart(2, '0');
  const localTimezone = `${tzName} (UTC${tzSign}${tzHours}:${tzMins})`;

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const generatedAtLocal = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate()
  )} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(
    now.getSeconds()
  )} ${localTimezone}`;

  const c = state.activeCase;
  const evidenceList = Array.isArray(state.evidenceList) ? state.evidenceList : [];
  const entities = Array.isArray(state.entities) ? state.entities : [];
  const relationships = Array.isArray(state.relationships) ? state.relationships : [];
  const timeline = Array.isArray(state.timeline) ? state.timeline : [];
  const ledger = Array.isArray(state.ledger) ? state.ledger : [];

  const caseId = c?.id || 'Not recorded';
  const caseNumber = c?.caseNumber || 'Not recorded';
  const caseName = c?.title || 'Not recorded';

  const isSeededPreloadedCase =
    c?.caseOrigin !== 'USER_CREATED' &&
    !caseId.startsWith('case-custom-') &&
    (c?.caseOrigin === 'PRELOADED' ||
      caseId.startsWith('case-phantom-upi') ||
      caseId.startsWith('case-bec-swift') ||
      caseNumber === 'CASE-2026-0841' ||
      caseNumber === 'CASE-2026-0842' ||
      caseNumber.startsWith('CFX-2026-0914') ||
      caseNumber.startsWith('CFX-2026-0918'));

  const dataSourceClassification = isSeededPreloadedCase
    ? 'Case origin: Pre-loaded case (with current in-session workspace state)'
    : 'Case origin: Entered in this workspace';

  const dataSourceNote = isSeededPreloadedCase
    ? 'Case origin: Pre-loaded case. Any files, timeline steps, or graph links added or modified during the current workspace session are included below.'
    : 'Case origin: Entered in this workspace. Generated from investigator-entered case records in current application state.';

  // ── Section 4: Chronological Timeline (stable chronological sort; missing dates at end)
  const timelineWithSort = timeline.map((item, originalIdx) => {
    const tsInfo = detectTimestampInfo(item.eventTimestamp);
    return {
      item,
      originalIdx,
      sortKey: tsInfo.sortKey,
      timestampDisplay: tsInfo.display,
      timezoneNote: tsInfo.timezoneNote,
    };
  });

  timelineWithSort.sort((a, b) => {
    if (a.sortKey === null && b.sortKey === null) {
      return a.originalIdx - b.originalIdx;
    }
    if (a.sortKey === null) return 1;
    if (b.sortKey === null) return -1;
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return a.originalIdx - b.originalIdx;
  });

  const timelineRows: ReportTimelineRow[] = timelineWithSort.map((entry, idx) => {
    const ev = entry.item;
    const parties: string[] = [];
    if (ev.actorEntity && ev.actorEntity.trim()) {
      parties.push(`From: ${ev.actorEntity.trim()}`);
    }
    if (ev.targetEntity && ev.targetEntity.trim()) {
      parties.push(`To: ${ev.targetEntity.trim()}`);
    }
    const involvedParties = parties.length > 0 ? parties.join(' -> ') : 'Not recorded';

    const hasWarning = Boolean(ev.anomalyFlag);
    const warningOrStatus = hasWarning
      ? `Warning: ${ev.anomalyReason || 'Timestamp or metadata discrepancy flagged'}`
      : 'Recorded (no anomaly flagged)';

    return {
      stepNumber: idx + 1,
      id: ev.id || `step-${idx + 1}`,
      recordedTimestamp: ev.eventTimestamp || 'Date not recorded',
      timestampDisplay: entry.timestampDisplay,
      timezoneNote: entry.timezoneNote,
      eventTitle: ev.title || 'Not recorded',
      description: ev.description || 'Not recorded',
      killChainPhase: ev.killChainPhase || 'Not recorded',
      involvedParties,
      amountRecorded:
        ev.amountInvolved && ev.amountInvolved.trim()
          ? ev.amountInvolved.trim()
          : 'Not recorded',
      linkedEvidenceCode: ev.evidenceCode || ev.evidenceId || 'Not recorded',
      warningOrStatus,
      hasWarning,
    };
  });

  // ── Section 5: Evidence Register
  const evidenceRows: ReportEvidenceRow[] = evidenceList.map((ev, idx) => {
    const statusRaw = ev.integrityStatus || 'UNVERIFIED';
    const verificationStatus =
      statusRaw === 'VERIFIED_INTACT'
        ? 'VERIFIED_INTACT (file fingerprint matches upload record)'
        : statusRaw === 'TAMPER_DETECTED'
        ? 'TAMPER_DETECTED (file fingerprint mismatch detected)'
        : 'UNVERIFIED';

    const tsInfo = detectTimestampInfo(ev.uploadedAt);

    return {
      evidenceCode: ev.evidenceCode || `EVD-${String(idx + 1).padStart(3, '0')}`,
      id: ev.id || `ev-${idx + 1}`,
      filename: ev.originalFilename || 'Not recorded',
      categoryAndMime: `${ev.evidenceCategory || 'Not recorded'} (${
        ev.detectedMimeType || 'mime not recorded'
      })`,
      sizeBytes: typeof ev.fileSizeBytes === 'number' ? ev.fileSizeBytes : 0,
      sizeFormatted: formatBytesReadable(ev.fileSizeBytes),
      sha256Fingerprint: ev.sha256Hash || 'Not recorded',
      blake3Fingerprint: ev.blake3Hash || 'Not recorded',
      acquisitionSource: ev.uploadedBy || 'Not recorded',
      uploadedAt: tsInfo.display,
      verificationStatus,
      timestampAnomaly: Boolean(ev.timestampAnomaly),
      timestampAnomalyDetail: ev.timestampAnomaly
        ? ev.timestampAnomalyDetail ||
          'Camera/EXIF timestamp differs from transaction or server timestamp.'
        : 'None recorded',
    };
  });

  // ── Section 6: Entities & Relationships
  const entityById = new Map<string, ExtractedEntity>();
  entities.forEach((ent) => {
    if (ent.id) entityById.set(ent.id, ent);
  });

  const relationshipRows: ReportRelationshipRow[] = relationships.map((rel, idx) => {
    const src = entityById.get(rel.sourceEntityId);
    const dst = entityById.get(rel.targetEntityId);
    return {
      id: rel.id || `rel-${idx + 1}`,
      sourceLabel: src?.displayLabel || src?.normalizedValue || rel.sourceEntityId || 'Not recorded',
      relationshipType: rel.label || rel.relationshipType || 'CONNECTED_TO',
      targetLabel: dst?.displayLabel || dst?.normalizedValue || rel.targetEntityId || 'Not recorded',
      weight: typeof rel.weight === 'number' ? rel.weight : 1,
      evidenceRef: rel.evidenceId || 'Not recorded',
    };
  });

  const entityRows: ReportEntityRow[] = entities.map((ent, idx) => {
    const related = relationships
      .filter((r) => r.sourceEntityId === ent.id || r.targetEntityId === ent.id)
      .map((r) => {
        const isOutgoing = r.sourceEntityId === ent.id;
        const otherId = isOutgoing ? r.targetEntityId : r.sourceEntityId;
        const other = entityById.get(otherId);
        const otherName = other?.displayLabel || other?.normalizedValue || otherId;
        const verb = r.label || r.relationshipType || 'CONNECTED_TO';
        return isOutgoing ? `${verb} -> ${otherName}` : `${otherName} -> ${verb}`;
      });

    return {
      id: ent.id || `ent-${idx + 1}`,
      displayLabel: ent.displayLabel || ent.normalizedValue || 'Not recorded',
      entityType: ent.entityType || 'UNKNOWN',
      plainCategory: getPlainEntityCategory(ent.entityType),
      normalizedValue: ent.normalizedValue || 'Not recorded',
      roleInIncident: ent.roleInIncident || 'Not recorded',
      riskLevel: ent.riskLevel || 'INFO',
      confidencePct:
        typeof ent.confidenceScore === 'number'
          ? `${Math.round(ent.confidenceScore * 100)}%`
          : 'Not recorded',
      linkedEvidenceCount: Array.isArray(ent.evidenceIds) ? ent.evidenceIds.length : 0,
      relationshipSummaries: related.length > 0 ? related : ['No graph links recorded'],
    };
  });

  // ── Section 7: Financial Movements & Multi-Currency Exposure Summary
  // Deduplicate ONLY when a real transaction ID (UTR/IMPS/SWIFT/TXN) matches.
  // Never sum different currencies together.
  const seenTransactionIds = new Map<string, string>();
  const movements: ReportFinancialMovement[] = [];

  if (Array.isArray(c?.transactions)) {
    c.transactions.forEach((tx, idx) => {
      const txAny = tx as unknown as Record<string, unknown>;
      const txId = tx.referenceId && tx.referenceId.trim() ? tx.referenceId.trim() : null;
      const tsInfo = detectTimestampInfo(tx.timestamp);
      const currency = (tx.currency || 'UNSPECIFIED').toUpperCase();
      let amount: number | null = null;
      if (typeof txAny.amount === 'number' && Number.isFinite(txAny.amount)) {
        amount = txAny.amount;
      } else if (typeof tx.amountMinor === 'number' && Number.isFinite(tx.amountMinor)) {
        amount = tx.amountMinor / 100;
      } else if (typeof tx.amountDisplay === 'string' && tx.amountDisplay.trim()) {
        const parsedDisplay = Number(tx.amountDisplay.replace(/,/g, '').trim());
        if (Number.isFinite(parsedDisplay)) amount = parsedDisplay;
      }
      const rawAmt =
        amount !== null
          ? formatCurrencyValue(amount, currency)
          : `${tx.amountDisplay ?? txAny.amount ?? ''} ${currency}`.trim();

      let deduplicationNote =
        'No stable transaction ID in record; listed separately (possible duplicates unresolved).';
      if (txId) {
        if (seenTransactionIds.has(txId)) {
          deduplicationNote = `Duplicate of transaction ID ${txId} (already counted in ${seenTransactionIds.get(
            txId
          )}); excluded from currency subtotal.`;
        } else {
          seenTransactionIds.set(txId, tx.id || `TX-${idx + 1}`);
          deduplicationNote = `Unique transaction ID ${txId}; included in currency subtotal.`;
        }
      }

      const resolvedFrom =
        (typeof txAny.fromParty === 'string' && txAny.fromParty.trim()) ||
        (tx.fromEntityId && entityById.get(tx.fromEntityId)?.displayLabel) ||
        tx.fromEntityId ||
        'Not recorded';
      const resolvedTo =
        (typeof txAny.toParty === 'string' && txAny.toParty.trim()) ||
        (tx.toEntityId && entityById.get(tx.toEntityId)?.displayLabel) ||
        tx.toEntityId ||
        'Not recorded';

      movements.push({
        recordId: tx.id || `tx-fin-${idx + 1}`,
        sourceType: 'FINANCIAL_TRANSACTION',
        referenceCode: tx.referenceId || tx.paymentRail || `TX-${idx + 1}`,
        timestamp: tsInfo.display,
        rawAmountText: rawAmt,
        parsedAmount: amount,
        currency,
        transactionId: txId,
        fromParty: resolvedFrom,
        toParty: resolvedTo,
        deduplicationNote,
      });
    });
  }

  timelineWithSort.forEach(({ item: ev, timestampDisplay }) => {
    if (!ev.amountInvolved || !ev.amountInvolved.trim()) return;
    const rawAmt = ev.amountInvolved.trim();
    const parsed = parseCurrencyAndAmount(rawAmt);
    const txId =
      extractTransactionId(rawAmt) ||
      extractTransactionId(ev.description || '') ||
      extractTransactionId(ev.title || '');

    let deduplicationNote =
      'No stable transaction ID in record; listed separately (possible duplicates unresolved).';
    if (txId) {
      if (seenTransactionIds.has(txId)) {
        deduplicationNote = `Duplicate of transaction ID ${txId} (already counted in ${seenTransactionIds.get(
          txId
        )}); excluded from currency subtotal.`;
      } else {
        seenTransactionIds.set(txId, ev.evidenceCode || ev.id);
        deduplicationNote = `Unique transaction ID ${txId}; included in currency subtotal.`;
      }
    }

    movements.push({
      recordId: ev.id || `tl-fin-${movements.length + 1}`,
      sourceType: 'TIMELINE_EVENT',
      referenceCode: ev.evidenceCode || ev.id || 'Timeline step',
      timestamp: timestampDisplay,
      rawAmountText: rawAmt,
      parsedAmount: parsed?.amount ?? null,
      currency: parsed?.currency || 'UNSPECIFIED',
      transactionId: txId,
      fromParty: ev.actorEntity || 'Not recorded',
      toParty: ev.targetEntity || 'Not recorded',
      deduplicationNote,
    });
  });

  // Compute subtotals per currency (excluding only records with a matching already-seen transactionId)
  const countedTxIds = new Set<string>();
  const subtotalMap = new Map<
    string,
    { sum: number; count: number; unresolvedDupCount: number }
  >();

  movements.forEach((m) => {
    if (m.parsedAmount === null) return;
    if (m.transactionId) {
      if (countedTxIds.has(m.transactionId)) {
        return; // Deduplicated by real transaction ID
      }
      countedTxIds.add(m.transactionId);
    }
    const entry = subtotalMap.get(m.currency) || {
      sum: 0,
      count: 0,
      unresolvedDupCount: 0,
    };
    entry.sum += m.parsedAmount;
    entry.count += 1;
    if (!m.transactionId) {
      entry.unresolvedDupCount += 1;
    }
    subtotalMap.set(m.currency, entry);
  });

  const currencySubtotals: ReportCurrencySubtotal[] = Array.from(
    subtotalMap.entries()
  ).map(([currency, data]) => ({
    currency,
    subtotalAmount: data.sum,
    formattedSubtotal: formatCurrencyValue(data.sum, currency),
    recordCount: data.count,
    unresolvedDuplicateCount: data.unresolvedDupCount,
  }));

  const hasRealExposure =
    typeof c?.estimatedLossUsd === 'number' &&
    !Number.isNaN(c.estimatedLossUsd) &&
    (c.estimatedLossUsd > 0 || isSeededPreloadedCase);

  const recordedCaseHeadlineExposure = hasRealExposure
    ? `$${c!.estimatedLossUsd.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })} USD (case summary estimate)`
    : currencySubtotals.length > 0
    ? currencySubtotals.map((s) => s.formattedSubtotal).join(' + ')
    : 'Not recorded';

  // ── Section 8: Warnings & Anomalies
  const warnings: ReportWarningItem[] = [];
  const incidentStartSortKey = c?.incidentDate ? detectTimestampInfo(c.incidentDate).sortKey : null;
  const nowPlusBufferMs = Date.now() + 24 * 60 * 60 * 1000;

  evidenceList.forEach((ev) => {
    if (!ev.sha256Hash || !ev.sha256Hash.trim()) {
      warnings.push({
        id: `warn-nohash-${ev.id}`,
        sourceRef: `${ev.evidenceCode} (${ev.originalFilename})`,
        category: 'Missing SHA-256 Fingerprint',
        severity: 'MEDIUM',
        whatWasFound: 'Evidence record was registered as metadata-only without a cryptographic SHA-256 file digest.',
        whyItMatters:
          'Without a cryptographic digest, independent byte-level integrity verification cannot be performed.',
      });
    }
    const evTs = detectTimestampInfo(ev.uploadedAt).sortKey;
    if (incidentStartSortKey !== null && evTs !== null && evTs < incidentStartSortKey - 86400000) {
      warnings.push({
        id: `warn-ev-before-inc-${ev.id}`,
        sourceRef: `${ev.evidenceCode} (${ev.originalFilename})`,
        category: 'Evidence Timestamp Precedes Incident Start',
        severity: 'MEDIUM',
        whatWasFound: `Evidence timestamp (${ev.uploadedAt}) is earlier than the recorded incident start date (${c?.incidentDate}).`,
        whyItMatters:
          'May indicate clock skew on the source system or pre-incident reconnaissance artifacts.',
      });
    }
  });

  if (Array.isArray(c?.transactions)) {
    c.transactions.forEach((tx, idx) => {
      if (!tx.fromEntityId || !tx.toEntityId) {
        warnings.push({
          id: `warn-tx-party-${tx.id || idx}`,
          sourceRef: tx.referenceId || `Transaction #${idx + 1}`,
          category: 'Incomplete Transaction Counterparty',
          severity: 'MEDIUM',
          whatWasFound: 'Financial transaction record is missing a linked sender or recipient entity.',
          whyItMatters:
            'Incomplete counterparty attribution prevents full end-to-end fund flow graph reconstruction.',
        });
      }
    });
  }

  timelineWithSort.forEach(({ item: ev, sortKey }) => {
    if (sortKey !== null && sortKey > nowPlusBufferMs) {
      warnings.push({
        id: `warn-tl-future-${ev.id}`,
        sourceRef: `${ev.evidenceCode || 'Timeline'} (${ev.title})`,
        category: 'Future-Dated Timeline Event',
        severity: 'MEDIUM',
        whatWasFound: `Timeline event timestamp (${ev.eventTimestamp}) is set in the future relative to report generation time.`,
        whyItMatters:
          'Indicates an uncalibrated source clock, timezone conversion error, or data entry mistake.',
      });
    }
  });

  evidenceList.forEach((ev) => {
    if (ev.integrityStatus === 'TAMPER_DETECTED') {
      warnings.push({
        id: `warn-tamper-${ev.id}`,
        sourceRef: `${ev.evidenceCode} (${ev.originalFilename})`,
        category: 'File Fingerprint Mismatch',
        severity: 'CRITICAL',
        whatWasFound: `Current file fingerprint (hash) does not match the SHA-256 fingerprint recorded at upload.`,
        whyItMatters:
          'Indicates the file bytes were modified after initial ingestion and must be re-acquired or excluded.',
      });
    }
    if (ev.timestampAnomaly) {
      warnings.push({
        id: `warn-exif-${ev.id}`,
        sourceRef: `${ev.evidenceCode} (${ev.originalFilename})`,
        category: 'Photo / EXIF Timestamp Discrepancy',
        severity: 'HIGH',
        whatWasFound:
          ev.timestampAnomalyDetail ||
          'Embedded camera/EXIF clock differs from the payment network or server timestamp.',
        whyItMatters:
          'Shows the screenshot or receipt metadata was edited or captured on a device with an altered clock, so independent bank/server logs should be relied upon for exact timing.',
      });
    }
  });

  timelineWithSort.forEach(({ item: ev }) => {
    if (ev.anomalyFlag) {
      const alreadyCovered = warnings.some(
        (w) =>
          ev.evidenceCode &&
          w.sourceRef.startsWith(ev.evidenceCode) &&
          w.category.includes('Timestamp')
      );
      if (!alreadyCovered) {
        warnings.push({
          id: `warn-tl-${ev.id}`,
          sourceRef: `${ev.evidenceCode || 'Timeline'} (${ev.title})`,
          category: 'Timeline Sequence Warning',
          severity: ev.severity || 'HIGH',
          whatWasFound:
            ev.anomalyReason ||
            'Discrepancy noted between device metadata and network event sequence.',
          whyItMatters:
            'Highlights a timing inconsistency that reviewers should cross-check against primary server logs.',
        });
      }
    }
  });

  if (Array.isArray(c?.riskIndicators)) {
    c.riskIndicators.forEach((ri) => {
      warnings.push({
        id: `warn-ri-${ri.id || ri.code}`,
        sourceRef: ri.evidenceRef || ri.code || 'Case Indicator',
        category: ri.category || 'Risk Indicator',
        severity: ri.severity || 'HIGH',
        whatWasFound: `${ri.title}: ${ri.description}`,
        whyItMatters:
          'Identifies high-risk technical patterns (such as anonymizing relays or rapid pass-through layering) supporting the case risk score.',
      });
    });
  }

  // ── Section 9: Integrity & Chain of Custody
  const verifiedIntactCount = evidenceList.filter(
    (e) => e.integrityStatus === 'VERIFIED_INTACT'
  ).length;
  const tamperedCount = evidenceList.filter(
    (e) => e.integrityStatus === 'TAMPER_DETECTED'
  ).length;
  const unverifiedCount = Math.max(
    0,
    evidenceList.length - verifiedIntactCount - tamperedCount
  );

  const headMerkleHash =
    state.chainVerification?.headMerkleHash ||
    (ledger.length > 0 ? ledger[ledger.length - 1].entryHash : 'Not recorded');

  const merkleChainStatus =
    tamperedCount > 0
      ? `Alert: ${tamperedCount} of ${evidenceList.length} evidence file(s) failed fingerprint comparison.`
      : evidenceList.length > 0
      ? `${verifiedIntactCount} of ${evidenceList.length} evidence file(s) match their recorded SHA-256 file fingerprints in workspace state.`
      : 'No evidence files recorded in this case.';

  // ── Section 2: Executive Summary
  const whatHappened =
    c?.summary && c.summary.trim()
      ? c.summary.trim()
      : timelineRows.length > 0
      ? `Recorded sequence comprises ${timelineRows.length} event(s) beginning with "${timelineRows[0].eventTitle}" and concluding with "${
          timelineRows[timelineRows.length - 1].eventTitle
        }".`
      : 'Not recorded — no case summary or timeline events have been entered yet.';

  const highRiskEntities = entities
    .filter((e) => e.riskLevel === 'CRITICAL' || e.riskLevel === 'HIGH')
    .slice(0, 4)
    .map((e) => `${e.displayLabel} (${getPlainEntityCategory(e.entityType)})`);

  const principalRisk =
    c && typeof c.riskScore === 'number'
      ? `Severity ${c.severity || 'Not recorded'} (Risk score ${c.riskScore}/100). ${
          highRiskEntities.length > 0
            ? `Primary high-risk entities in graph: ${highRiskEntities.join(', ')}.`
            : 'No high-risk entities flagged in graph.'
        }`
      : 'Not recorded';

  const knownExposure =
    currencySubtotals.length > 0
      ? `Case headline estimate: ${recordedCaseHeadlineExposure}. Recorded timeline movements by currency: ${currencySubtotals
          .map(
            (s) =>
              `${s.formattedSubtotal} across ${s.recordCount} record(s)${
                s.unresolvedDuplicateCount > 0
                  ? ' (includes records without unique transaction IDs; possible duplicates unresolved)'
                  : ''
              }`
          )
          .join('; ')}.`
      : `Case headline estimate: ${recordedCaseHeadlineExposure}. No itemized financial movements recorded in timeline.`;

  const supportedConclusion =
    evidenceList.length === 0 && timelineRows.length === 0
      ? 'Insufficient recorded data: this case currently has no uploaded evidence files or timeline steps.'
      : tamperedCount > 0
      ? `The recorded data links ${entities.length} correlated entities across ${timelineRows.length} timeline step(s), but ${tamperedCount} evidence file(s) show a fingerprint mismatch and require re-verification before reliance.`
      : `The recorded data links ${evidenceList.length} evidence file(s), ${entities.length} correlated entities, and ${timelineRows.length} chronological step(s). ${
          warnings.length > 0
            ? `${warnings.length} warning(s)/anomalies (including metadata or timestamp checks) are documented in Section 8 for reviewer evaluation.`
            : 'No file fingerprint mismatches were detected across the recorded artifacts.'
        }`;

  // ── Section 10: Conclusion & Next Review Points + Glossary
  const nextReviewPoints: string[] = [];
  if (evidenceList.length === 0) {
    nextReviewPoints.push(
      'Ingest primary evidence files (screenshots, bank receipts, or communication headers) to establish baseline SHA-256 file fingerprints.'
    );
  }
  if (tamperedCount > 0) {
    nextReviewPoints.push(
      `Investigate the ${tamperedCount} evidence artifact(s) flagged with TAMPER_DETECTED and restore or re-acquire unaltered originals.`
    );
  }
  if (evidenceList.some((e) => e.timestampAnomaly)) {
    nextReviewPoints.push(
      'Cross-verify any screenshot or receipt showing a camera/EXIF timestamp discrepancy against independent bank or telecom server logs.'
    );
  }
  if (currencySubtotals.some((s) => s.unresolvedDuplicateCount > 0)) {
    nextReviewPoints.push(
      'Obtain bank UTR, IMPS, or blockchain transaction hashes for financial entries lacking a stable transaction ID to resolve potential duplicate listings.'
    );
  }
  if (entities.some((e) => e.entityType === 'CRYPTO_WALLET' || e.entityType === 'BANK_ACCOUNT' || e.entityType === 'UPI_ID')) {
    nextReviewPoints.push(
      'Submit preservation requests to the relevant payment service providers and exchanges for the beneficiary accounts and wallet addresses listed in Section 6.'
    );
  }
  if (nextReviewPoints.length === 0) {
    nextReviewPoints.push(
      'Review the correlated entity graph and chronological timeline against external institutional records prior to final case sign-off.'
    );
  }

  const glossary = [
    {
      term: 'File fingerprint (hash / SHA-256)',
      definition:
        'A 64-character hexadecimal string computed mathematically from a file’s exact bytes. Changing even one byte of the file produces a completely different fingerprint.',
    },
    {
      term: 'EXIF metadata',
      definition:
        'Hidden technical details saved inside an image file by a camera or phone, such as the device clock time when the photo or screenshot was created.',
    },
    {
      term: 'Pass-through / mule account',
      definition:
        'An intermediary bank account or payment ID used to receive funds and rapidly forward them to other accounts or cryptocurrency wallets.',
    },
    {
      term: 'Chain of custody',
      definition:
        'A chronological activity log recording who uploaded, inspected, or verified each evidence item and when each action occurred.',
    },
    {
      term: 'WORM lock (Write-Once-Read-Many)',
      definition:
        'A storage policy where an uploaded evidence file is locked against modification so future integrity checks can compare the stored file against its original fingerprint.',
    },
  ];

  return {
    metadata: {
      schemaVersion: '1.0.0',
      reportTitle: `CyberFusion X — Forensic Case Report (${caseNumber})`,
      caseId,
      caseNumber,
      caseName,
      generatedAtUtc,
      generatedAtLocal,
      localTimezone,
      reportStatus: 'Draft: generated from application state',
      dataSourceClassification,
      dataSourceNote,
      preparedBy:
        state.currentUser?.fullName ||
        c?.leadInvestigatorName ||
        'Not recorded',
      nonLatinSubstitutionsApplied: 0,
    },
    summary: {
      whatHappened,
      principalRisk,
      knownExposure,
      supportedConclusion,
    },
    metrics: {
      caseNumber,
      caseTitle: caseName,
      incidentType: c?.incidentType ? c.incidentType.replace(/_/g, ' ') : 'Not recorded',
      status: 'Draft: generated from application state',
      severity: c?.severity || 'Not recorded',
      riskScore: typeof c?.riskScore === 'number' ? `${c.riskScore} / 100` : 'Not recorded',
      victimName: c?.victimName || 'Not recorded',
      leadInvestigator:
        c?.leadInvestigatorName || state.currentUser?.fullName || 'Not recorded',
      recordedCaseLossUsd: recordedCaseHeadlineExposure,
      evidenceFileCount: evidenceList.length,
      verifiedIntactFileCount: verifiedIntactCount,
      tamperedFileCount: tamperedCount,
      correlatedEntityCount: entities.length,
      relationshipEdgeCount: relationships.length,
      timelineStepCount: timelineRows.length,
      warningAndAnomalyCount: warnings.length,
    },
    timeline: timelineRows,
    evidence: evidenceRows,
    entities: entityRows,
    relationships: relationshipRows,
    financialSummary: {
      recordedCaseHeadlineExposure,
      movements,
      currencySubtotals,
      deduplicationPolicyNote:
        'Financial movements are grouped by currency and never summed across different currencies. Records are deduplicated only when an explicit transaction ID (such as UTR, IMPS, SWIFT, or TXN reference) matches; records without a transaction ID are listed separately with "possible duplicates unresolved".',
    },
    warnings,
    integrity: {
      scopeSummary:
        'Scope: Compares each evidence item’s stored SHA-256 file fingerprint (hash) in current application state against the fingerprint recorded at upload, and lists recorded chain-of-custody log entries.',
      verifiedIntactCount,
      tamperedCount,
      unverifiedCount,
      totalEvidenceCount: evidenceList.length,
      merkleChainStatus,
      headMerkleHash,
      presentationDisclaimer:
        'Scope Note: Verification statuses in this section reflect the case evidence records in workspace state. The homepage hero "Fingerprint ready" animation is an illustrative UI preview and is never cited as proof of case evidence integrity.',
      custodyEntries: ledger.map((entry, i) => ({
        sequenceNumber:
          typeof entry.sequenceNumber === 'number' ? entry.sequenceNumber : i + 1,
        timestamp: detectTimestampInfo(entry.timestamp || (entry as any).createdAt).display,
        actor: entry.actorUsername || 'Not recorded',
        role: entry.actorRole || 'Not recorded',
        actionType: entry.actionType || 'Not recorded',
        targetResource: entry.targetResource || 'Not recorded',
        details: entry.details || 'Not recorded',
        entryHash: entry.entryHash || 'Not recorded',
      })),
    },
    conclusion: {
      summaryStatement: supportedConclusion,
      nextReviewPoints,
    },
    glossary,
  };
}

/**
 * Sanitizes a case ID / title and date into a safe cross-platform download filename.
 */
export function buildSanitizedReportFilename(
  caseNumberOrId: string | undefined | null,
  caseTitle: string | undefined | null,
  extension: 'pdf' | 'json' | 'md' | 'csv',
  date: Date = new Date()
): string {
  const rawId = (caseNumberOrId || 'case').trim();
  const rawTitle = (caseTitle || 'report').trim();
  const datePart = date.toISOString().slice(0, 10);

  const cleanPart = (str: string, maxLen: number) =>
    str
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, maxLen) || 'item';

  const safeId = cleanPart(rawId, 24);
  const safeTitle = cleanPart(rawTitle, 36);
  const ext = extension.replace(/^\./, '');
  return `${safeId}_${safeTitle}_${datePart}.${ext}`;
}

/**
 * Generates a complete, readable 10-section Markdown report from the shared ForensicReportModel.
 */
export function generateReportMarkdown(model: ForensicReportModel): string {
  const lines: string[] = [];

  // 1. Header & Metadata
  lines.push(`# ${model.metadata.reportTitle}`);
  lines.push('');
  lines.push(`- **Case Number / ID:** ${model.metadata.caseNumber} (\`${model.metadata.caseId}\`)`);
  lines.push(`- **Case Name:** ${model.metadata.caseName}`);
  lines.push(`- **Generated Date/Time (Local):** ${model.metadata.generatedAtLocal}`);
  lines.push(`- **Generated Date/Time (UTC ISO):** ${model.metadata.generatedAtUtc}`);
  lines.push(`- **Report Status:** ${model.metadata.reportStatus}`);
  lines.push(`- **Prepared By:** ${model.metadata.preparedBy}`);
  lines.push(`- **Data Classification:** ${model.metadata.dataSourceClassification}`);
  lines.push(`> ${model.metadata.dataSourceNote}`);
  lines.push('');

  // 2. Executive Summary
  lines.push('## 1. Executive Summary');
  lines.push(`- **What Happened:** ${model.summary.whatHappened}`);
  lines.push(`- **Principal Risk:** ${model.summary.principalRisk}`);
  lines.push(`- **Known Exposure:** ${model.summary.knownExposure}`);
  lines.push(`- **Supported Conclusion:** ${model.summary.supportedConclusion}`);
  lines.push('');

  // 3. Case Overview & Key Figures
  lines.push('## 2. Case Overview & Key Figures');
  lines.push(`- **Incident Type:** ${model.metrics.incidentType}`);
  lines.push(`- **Severity & Risk Score:** ${model.metrics.severity} (${model.metrics.riskScore})`);
  lines.push(`- **Victim:** ${model.metrics.victimName}`);
  lines.push(`- **Lead Investigator:** ${model.metrics.leadInvestigator}`);
  lines.push(`- **Recorded Case Headline Exposure:** ${model.metrics.recordedCaseLossUsd}`);
  lines.push(
    `- **Counts:** ${model.metrics.evidenceFileCount} evidence file(s) (${model.metrics.verifiedIntactFileCount} intact, ${model.metrics.tamperedFileCount} tampered) · ${model.metrics.correlatedEntityCount} correlated entities · ${model.metrics.relationshipEdgeCount} relationships · ${model.metrics.timelineStepCount} timeline step(s) · ${model.metrics.warningAndAnomalyCount} warning(s)`
  );
  lines.push('');

  // 4. Chronological Timeline
  lines.push('## 3. Chronological Timeline');
  if (model.timeline.length === 0) {
    lines.push('Not recorded — no timeline steps are present in current case state.');
  } else {
    model.timeline.forEach((step) => {
      lines.push(
        `### Step ${step.stepNumber}: ${step.eventTitle} [${step.linkedEvidenceCode}]`
      );
      lines.push(`- **Date/Time:** ${step.timestampDisplay}`);
      lines.push(`- **Phase:** ${step.killChainPhase}`);
      lines.push(`- **Involved Parties:** ${step.involvedParties}`);
      lines.push(`- **Amount:** ${step.amountRecorded}`);
      lines.push(`- **Status / Warning:** ${step.warningOrStatus}`);
      lines.push(`- **Details:** ${step.description}`);
      lines.push('');
    });
  }

  // 5. Evidence Register
  lines.push('## 4. Evidence Register');
  lines.push(
    '_Note: Each uploaded file is identified by a cryptographic file fingerprint (hash — SHA-256) computed from its bytes._'
  );
  lines.push('');
  if (model.evidence.length === 0) {
    lines.push('Not recorded — no evidence files are present in current case state.');
  } else {
    model.evidence.forEach((ev) => {
      lines.push(`### ${ev.evidenceCode} — ${ev.filename}`);
      lines.push(`- **Artifact ID:** \`${ev.id}\``);
      lines.push(`- **Type / MIME:** ${ev.categoryAndMime}`);
      lines.push(`- **Size:** ${ev.sizeFormatted}`);
      lines.push(`- **File Fingerprint (SHA-256 Hash):** \`${ev.sha256Fingerprint}\``);
      lines.push(`- **Secondary Fingerprint (BLAKE3):** \`${ev.blake3Fingerprint}\``);
      lines.push(`- **Acquisition / Uploaded By:** ${ev.acquisitionSource} at ${ev.uploadedAt}`);
      lines.push(`- **Verification Status:** ${ev.verificationStatus}`);
      lines.push(`- **Metadata / Timestamp Check:** ${ev.timestampAnomalyDetail}`);
      lines.push('');
    });
  }

  // 6. Correlated Entities & Graph Relationships
  lines.push('## 5. Correlated Entities & Relationships');
  if (model.entities.length === 0) {
    lines.push('Not recorded — no correlated entities are present in current case state.');
  } else {
    model.entities.forEach((ent) => {
      lines.push(
        `- **${ent.displayLabel}** (${ent.plainCategory} · \`${ent.normalizedValue}\`) — Role: ${ent.roleInIncident} · Risk: ${ent.riskLevel} · Confidence: ${ent.confidencePct} · Linked files: ${ent.linkedEvidenceCount}`
      );
      lines.push(`  - Connections: ${ent.relationshipSummaries.join(' | ')}`);
    });
  }
  lines.push('');

  // 7. Financial Movements & Exposure Summary
  lines.push('## 6. Financial Movements & Exposure Summary');
  lines.push(`- **Recorded Case Headline Exposure:** ${model.financialSummary.recordedCaseHeadlineExposure}`);
  lines.push(`- **Policy:** ${model.financialSummary.deduplicationPolicyNote}`);
  if (model.financialSummary.currencySubtotals.length > 0) {
    lines.push('- **Subtotals by Currency (never summed across currencies):**');
    model.financialSummary.currencySubtotals.forEach((sub) => {
      lines.push(
        `  - **${sub.currency}:** ${sub.formattedSubtotal} (${sub.recordCount} record(s); unresolved potential duplicates without transaction ID: ${sub.unresolvedDuplicateCount})`
      );
    });
  } else {
    lines.push('- **Subtotals by Currency:** Not recorded');
  }
  if (model.financialSummary.movements.length > 0) {
    lines.push('');
    lines.push('### Itemized Financial Records');
    model.financialSummary.movements.forEach((m, idx) => {
      lines.push(
        `${idx + 1}. **[${m.referenceCode}]** ${m.timestamp} — **${m.rawAmountText}** (Currency: ${m.currency}, TxID: ${
          m.transactionId || 'None recorded'
        }) · ${m.fromParty} -> ${m.toParty} · _${m.deduplicationNote}_`
      );
    });
  }
  lines.push('');

  // 8. Warnings & Anomalies
  lines.push('## 7. Warnings & Anomalies');
  if (model.warnings.length === 0) {
    lines.push('None recorded in current case state.');
  } else {
    model.warnings.forEach((w, idx) => {
      lines.push(
        `${idx + 1}. **[${w.severity}] ${w.category} — ${w.sourceRef}:** ${w.whatWasFound}`
      );
      lines.push(`   - _Why it matters:_ ${w.whyItMatters}`);
    });
  }
  lines.push('');

  // 9. Integrity & Chain of Custody
  lines.push('## 8. Integrity & Chain-of-Custody Results');
  lines.push(`- ${model.integrity.scopeSummary}`);
  lines.push(`- **Status Summary:** ${model.integrity.merkleChainStatus}`);
  lines.push(`- **Recorded Merkle Root / Latest Chain Hash:** \`${model.integrity.headMerkleHash}\``);
  lines.push(`- **Important Note:** ${model.integrity.presentationDisclaimer}`);
  if (model.integrity.custodyEntries.length > 0) {
    lines.push('');
    lines.push('### Chain-of-Custody Log');
    model.integrity.custodyEntries.forEach((ce) => {
      lines.push(
        `- **#${ce.sequenceNumber}** (${ce.timestamp}) — **${ce.actionType}** by ${ce.actor} (${ce.role}) on \`${ce.targetResource}\`: ${ce.details} [Hash: \`${ce.entryHash}\`]`
      );
    });
  }
  lines.push('');

  // 10. Conclusion, Next Review Points & Glossary
  lines.push('## 9. Conclusion & Next Review Points');
  lines.push(model.conclusion.summaryStatement);
  lines.push('');
  model.conclusion.nextReviewPoints.forEach((pt, idx) => {
    lines.push(`${idx + 1}. ${pt}`);
  });
  lines.push('');
  lines.push('## 10. Short Technical Glossary');
  model.glossary.forEach((g) => {
    lines.push(`- **${g.term}:** ${g.definition}`);
  });
  lines.push('');

  return lines.join('\n');
}

/**
 * Neutralizes spreadsheet formula injection (cells starting with =, +, -, @, tab, CR)
 * without altering numeric values or underlying JSON/PDF data, and applies RFC 4180 CSV escaping.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  let str = String(value);
  const trimmed = str.trimStart();
  const isPureNumber = /^[+-]?\d+(\.\d+)?$/.test(trimmed);
  if (!isPureNumber && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Generates an RFC 4180 compliant CSV (with UTF-8 BOM for Excel) containing all case records
 * (Metadata, Timeline Steps, Evidence Register, Correlated Entities, Financial Movements, Warnings)
 * from the shared ForensicReportModel.
 */
export function generateReportCsv(model: ForensicReportModel): string {
  const header = [
    'Section',
    'Record_Code',
    'Timestamp',
    'Category_Or_Phase',
    'Title_Or_Name',
    'Identifier_Or_Hash',
    'Amount_Or_Size',
    'Currency_Or_Role',
    'Status_Or_Risk',
    'Details',
  ];

  const rows: string[][] = [header];

  // Metadata row
  rows.push([
    'CASE_OVERVIEW',
    model.metadata.caseNumber,
    model.metadata.generatedAtUtc,
    model.metrics.incidentType,
    model.metadata.caseName,
    model.metadata.caseId,
    model.metrics.recordedCaseLossUsd,
    model.metrics.leadInvestigator,
    model.metadata.reportStatus,
    model.summary.whatHappened,
  ]);

  // Timeline rows
  model.timeline.forEach((t) => {
    rows.push([
      'TIMELINE_STEP',
      `Step ${t.stepNumber} (${t.linkedEvidenceCode})`,
      t.timestampDisplay,
      t.killChainPhase,
      t.eventTitle,
      t.id,
      t.amountRecorded,
      t.involvedParties,
      t.warningOrStatus,
      t.description,
    ]);
  });

  // Evidence rows
  model.evidence.forEach((ev) => {
    rows.push([
      'EVIDENCE_FILE',
      ev.evidenceCode,
      ev.uploadedAt,
      ev.categoryAndMime,
      ev.filename,
      ev.sha256Fingerprint,
      ev.sizeFormatted,
      ev.acquisitionSource,
      ev.verificationStatus,
      ev.timestampAnomalyDetail,
    ]);
  });

  // Entity rows
  model.entities.forEach((ent) => {
    rows.push([
      'CORRELATED_ENTITY',
      ent.id,
      'Not recorded',
      ent.plainCategory,
      ent.displayLabel,
      ent.normalizedValue,
      `${ent.linkedEvidenceCount} linked file(s)`,
      ent.roleInIncident,
      `${ent.riskLevel} (${ent.confidencePct})`,
      ent.relationshipSummaries.join(' | '),
    ]);
  });

  // Financial movements
  model.financialSummary.movements.forEach((m) => {
    rows.push([
      'FINANCIAL_MOVEMENT',
      m.referenceCode,
      m.timestamp,
      m.sourceType,
      `${m.fromParty} -> ${m.toParty}`,
      m.transactionId || 'No transaction ID',
      m.rawAmountText,
      m.currency,
      m.deduplicationNote,
      `Parsed amount: ${m.parsedAmount !== null ? m.parsedAmount : 'Not parsed'}`,
    ]);
  });

  // Warnings
  model.warnings.forEach((w) => {
    rows.push([
      'WARNING_ANOMALY',
      w.sourceRef,
      'Not recorded',
      w.category,
      w.whatWasFound,
      w.id,
      'N/A',
      'Reviewer check',
      w.severity,
      w.whyItMatters,
    ]);
  });

  const csvBody = rows
    .map((r) => r.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\r\n');

  return `\uFEFF${csvBody}\r\n`;
}

/**
 * Transliterates / substitutes characters outside standard PDF Type1 WinAnsi/ASCII range
 * so standard Helvetica/Courier fonts in jsPDF never emit garbled glyphs.
 */
export function sanitizeForPdfFont(input: string): {
  text: string;
  substitutions: number;
} {
  if (!input) return { text: '', substitutions: 0 };
  let count = 0;

  // Common typographic & currency replacements that are exact ASCII equivalents
  const normalized = input
    .replace(/₹/g, 'INR ')
    .replace(/€/g, 'EUR ')
    .replace(/£/g, 'GBP ')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/↔/g, '<->')
    .replace(/✓|✔/g, '[OK]')
    .replace(/✗|✘/g, '[X]')
    .replace(/•|·/g, '-')
    .replace(/…/g, '...')
    .replace(/—|–/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  let out = '';
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    // Printable ASCII + basic Latin-1 supplement (160..255) supported by WinAnsiEncoding
    if (
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 32 && code <= 126) ||
      (code >= 160 && code <= 255)
    ) {
      out += normalized[i];
    } else {
      count += 1;
      out += '?';
    }
  }

  return { text: out, substitutions: count };
}

/**
 * Breaks unbroken long tokens (such as 64-char SHA-256 hashes, long URLs, or filenames)
 * at character boundaries so jsPDF splitTextToSize never overflows table cells or margins.
 */
function preBreakLongTokens(text: string, maxTokenChars: number): string {
  if (!text) return '';
  return text
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token) || token.length <= maxTokenChars) {
        return token;
      }
      const chunks: string[] = [];
      for (let i = 0; i < token.length; i += maxTokenChars) {
        chunks.push(token.slice(i, i + maxTokenChars));
      }
      return chunks.join(' ');
    })
    .join('');
}

/**
 * Generates a real, multi-section, multi-page PDF binary (Uint8Array starting with %PDF-)
 * from the shared ForensicReportModel using dynamic import('jspdf').
 */
export async function generateReportPdfBytes(
  model: ForensicReportModel
): Promise<{
  bytes: Uint8Array;
  pageCount: number;
  nonLatinSubstitutions: number;
}> {
  const jspdfMod = await import('jspdf');
  const JsPDFCtor = jspdfMod.jsPDF || (jspdfMod as any).default;

  const doc = new JsPDFCtor({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
    compress: false, // Keep stream text inspectable for programmatic E4 checks
  });

  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN_X = 40;
  const TOP_Y = 52;
  const BOTTOM_Y = PAGE_H - 46;
  const CONTENT_W = PAGE_W - MARGIN_X * 2; // 532pt

  let cursorY = TOP_Y;
  let totalSubstitutions = 0;

  const cleanText = (str: string): string => {
    const res = sanitizeForPdfFont(str || '');
    totalSubstitutions += res.substitutions;
    return res.text;
  };

  const ensureSpace = (neededPt: number) => {
    if (cursorY + neededPt > BOTTOM_Y) {
      doc.addPage();
      cursorY = TOP_Y;
    }
  };

  const drawSectionHeading = (numAndTitle: string) => {
    // Prevent orphaned headings by requiring at least 64pt before bottom margin
    ensureSpace(64);
    cursorY += 8;
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(MARGIN_X, cursorY, CONTENT_W, 22, 4, 4, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(29, 78, 216);
    doc.text(cleanText(numAndTitle), MARGIN_X + 8, cursorY + 14.5);
    cursorY += 30;
  };

  const drawParagraph = (
    text: string,
    opts?: {
      boldPrefix?: string;
      font?: 'helvetica' | 'courier';
      fontSize?: number;
      indent?: number;
      color?: [number, number, number];
    }
  ) => {
    const font = opts?.font || 'helvetica';
    const fontSize = opts?.fontSize || 9.2;
    const indent = opts?.indent || 0;
    const lineH = fontSize * 1.38;
    const availW = CONTENT_W - indent;

    const fullStr = opts?.boldPrefix
      ? `${opts.boldPrefix} ${text}`
      : text;
    const safeStr = preBreakLongTokens(cleanText(fullStr), font === 'courier' ? 68 : 48);

    doc.setFont(font, 'normal');
    doc.setFontSize(fontSize);
    const lines: string[] = doc.splitTextToSize(safeStr, availW);

    lines.forEach((line, idx) => {
      ensureSpace(lineH + 2);
      if (idx === 0 && opts?.boldPrefix) {
        doc.setFont(font, 'bold');
      } else {
        doc.setFont(font, 'normal');
      }
      const c = opts?.color || [15, 27, 51];
      doc.setTextColor(c[0], c[1], c[2]);
      doc.text(line, MARGIN_X + indent, cursorY + fontSize);
      cursorY += lineH;
    });
    cursorY += 3;
  };

  interface TableCol {
    header: string;
    width: number;
    mono?: boolean;
    maxToken?: number;
  }

  const drawTable = (cols: TableCol[], rows: string[][]) => {
    const padX = 5;
    const padY = 5;
    const fontSize = 8;
    const lineH = 10.5;

    const renderTableHeader = () => {
      ensureSpace(22);
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.rect(MARGIN_X, cursorY, CONTENT_W, 18, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);

      let colX = MARGIN_X;
      cols.forEach((col) => {
        doc.text(cleanText(col.header), colX + padX, cursorY + 12);
        colX += col.width;
      });
      cursorY += 18;
    };

    renderTableHeader();

    rows.forEach((row, rIdx) => {
      // Split each cell's text to fit its column width
      const cellLinesList: string[][] = cols.map((col, cIdx) => {
        const rawCell = cleanText(row[cIdx] ?? 'Not recorded');
        const maxTok = col.maxToken || Math.max(10, Math.floor(col.width / 5.2));
        const preBroken = preBreakLongTokens(rawCell, maxTok);
        doc.setFont(col.mono ? 'courier' : 'helvetica', 'normal');
        doc.setFontSize(fontSize);
        return doc.splitTextToSize(preBroken, Math.max(24, col.width - padX * 2));
      });

      const maxLines = Math.max(1, ...cellLinesList.map((cl) => cl.length));
      const rowH = maxLines * lineH + padY * 2;

      if (cursorY + rowH > BOTTOM_Y) {
        doc.addPage();
        cursorY = TOP_Y;
        renderTableHeader();
      }

      if (rIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(MARGIN_X, cursorY, CONTENT_W, rowH, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.rect(MARGIN_X, cursorY, CONTENT_W, rowH, 'S');

      let colX = MARGIN_X;
      cols.forEach((col, cIdx) => {
        doc.setFont(col.mono ? 'courier' : 'helvetica', 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(15, 27, 51);
        const lines = cellLinesList[cIdx];
        lines.forEach((ln, lIdx) => {
          doc.text(ln, colX + padX, cursorY + padY + 8 + lIdx * lineH);
        });
        colX += col.width;
      });

      cursorY += rowH;
    });

    cursorY += 8;
  };

  // ── 1. Title Banner & Metadata Block
  doc.setFillColor(15, 27, 51);
  doc.roundedRect(MARGIN_X, cursorY, CONTENT_W, 54, 6, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(cleanText(model.metadata.reportTitle), MARGIN_X + 14, cursorY + 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(191, 219, 254);
  doc.text(
    cleanText(
      `Status: ${model.metadata.reportStatus}   |   Case ID: ${model.metadata.caseId}`
    ),
    MARGIN_X + 14,
    cursorY + 37
  );
  doc.text(
    cleanText(
      `Generated: ${model.metadata.generatedAtLocal}   |   UTC: ${model.metadata.generatedAtUtc}`
    ),
    MARGIN_X + 14,
    cursorY + 48
  );
  cursorY += 64;

  drawParagraph(model.metadata.dataSourceNote, {
    fontSize: 8.5,
    color: [71, 85, 105],
  });

  // ── 2. Executive Summary
  drawSectionHeading('1. Executive Summary');
  drawParagraph(model.summary.whatHappened, { boldPrefix: 'What Happened:' });
  drawParagraph(model.summary.principalRisk, { boldPrefix: 'Principal Risk:' });
  drawParagraph(model.summary.knownExposure, { boldPrefix: 'Known Exposure:' });
  drawParagraph(model.summary.supportedConclusion, {
    boldPrefix: 'Supported Conclusion:',
  });

  // ── 3. Case Overview & Key Figures
  drawSectionHeading('2. Case Overview and Key Figures');
  drawTable(
    [
      { header: 'Field', width: 150 },
      { header: 'Recorded Value', width: 382 },
    ],
    [
      ['Case Number / ID', `${model.metrics.caseNumber} (${model.metadata.caseId})`],
      ['Case Title', model.metrics.caseTitle],
      ['Incident Typology', model.metrics.incidentType],
      ['Severity & Risk Score', `${model.metrics.severity} (${model.metrics.riskScore})`],
      ['Victim / Account Holder', model.metrics.victimName],
      ['Lead Investigator', model.metrics.leadInvestigator],
      ['Headline Exposure Estimate', model.metrics.recordedCaseLossUsd],
      [
        'Recorded Artifact Counts',
        `${model.metrics.evidenceFileCount} evidence files (${model.metrics.verifiedIntactFileCount} intact, ${model.metrics.tamperedFileCount} tampered), ${model.metrics.correlatedEntityCount} entities, ${model.metrics.relationshipEdgeCount} graph links, ${model.metrics.timelineStepCount} timeline steps`,
      ],
    ]
  );

  // ── 4. Chronological Timeline
  drawSectionHeading('3. Chronological Timeline of Events');
  if (model.timeline.length === 0) {
    drawParagraph('Not recorded — no timeline events are present in current case state.');
  } else {
    drawTable(
      [
        { header: 'Step', width: 34, mono: true },
        { header: 'Recorded Date/Time', width: 105, mono: true, maxToken: 20 },
        { header: 'Event & Description', width: 185 },
        { header: 'Involved Parties & Amount', width: 120 },
        { header: 'Evidence / Status', width: 88 },
      ],
      model.timeline.map((t) => [
        `#${t.stepNumber}`,
        t.timestampDisplay,
        `${t.eventTitle} (${t.killChainPhase}) - ${t.description}`,
        `${t.involvedParties} | Amount: ${t.amountRecorded}`,
        `${t.linkedEvidenceCode} | ${t.warningOrStatus}`,
      ])
    );
  }

  // ── 5. Evidence Register
  drawSectionHeading('4. Evidence Register (with File Fingerprints / SHA-256 Hashes)');
  drawParagraph(
    'On first use: a file fingerprint (hash) is a mathematical SHA-256 digest computed from the exact bytes of an evidence file when acquired.',
    { fontSize: 8.5, color: [71, 85, 105] }
  );
  if (model.evidence.length === 0) {
    drawParagraph('Not recorded — no evidence files are present in current case state.');
  } else {
    drawTable(
      [
        { header: 'Code', width: 52, mono: true },
        { header: 'Filename & Type', width: 136, maxToken: 22 },
        { header: 'Size & Source', width: 96 },
        { header: 'File Fingerprint (SHA-256 Hash)', width: 156, mono: true, maxToken: 32 },
        { header: 'Verification Status', width: 92 },
      ],
      model.evidence.map((ev) => [
        ev.evidenceCode,
        `${ev.filename} [${ev.categoryAndMime}]`,
        `${ev.sizeFormatted} | By: ${ev.acquisitionSource} (${ev.uploadedAt})`,
        ev.sha256Fingerprint,
        `${ev.verificationStatus}${
          ev.timestampAnomaly ? ` | Warning: ${ev.timestampAnomalyDetail}` : ''
        }`,
      ])
    );
  }

  // ── 6. Correlated Entities & Graph Relationships
  drawSectionHeading('5. Correlated Entities and Graph Relationships');
  if (model.entities.length === 0) {
    drawParagraph('Not recorded — no correlated entities are present in current case state.');
  } else {
    drawTable(
      [
        { header: 'Entity & Category', width: 120 },
        { header: 'Identifier / Value', width: 132, mono: true, maxToken: 24 },
        { header: 'Role & Risk', width: 95 },
        { header: 'Supported Graph Relationships', width: 185 },
      ],
      model.entities.map((ent) => [
        `${ent.displayLabel} (${ent.plainCategory})`,
        ent.normalizedValue,
        `${ent.roleInIncident} | ${ent.riskLevel} (${ent.confidencePct})`,
        ent.relationshipSummaries.join('; '),
      ])
    );
  }

  // ── 7. Financial Movements & Exposure Summary
  drawSectionHeading('6. Financial Movements and Multi-Currency Exposure');
  drawParagraph(model.financialSummary.deduplicationPolicyNote, {
    fontSize: 8.5,
    color: [71, 85, 105],
  });
  drawParagraph(model.financialSummary.recordedCaseHeadlineExposure, {
    boldPrefix: 'Case Summary Estimate:',
  });

  if (model.financialSummary.currencySubtotals.length > 0) {
    drawTable(
      [
        { header: 'Currency', width: 80, mono: true },
        { header: 'Currency Subtotal', width: 150, mono: true },
        { header: 'Records Counted', width: 100 },
        { header: 'Unresolved Potential Duplicates', width: 202 },
      ],
      model.financialSummary.currencySubtotals.map((s) => [
        s.currency,
        s.formattedSubtotal,
        String(s.recordCount),
        s.unresolvedDuplicateCount > 0
          ? `${s.unresolvedDuplicateCount} record(s) without transaction ID (possible duplicates unresolved)`
          : '0 (all records have unique transaction IDs)',
      ])
    );
  }

  if (model.financialSummary.movements.length > 0) {
    drawTable(
      [
        { header: 'Ref', width: 54, mono: true },
        { header: 'Timestamp', width: 98, mono: true },
        { header: 'Amount & Currency', width: 96, mono: true },
        { header: 'From -> To & TxID', width: 134 },
        { header: 'Deduplication Status', width: 150 },
      ],
      model.financialSummary.movements.map((m) => [
        m.referenceCode,
        m.timestamp,
        `${m.rawAmountText} [${m.currency}]`,
        `${m.fromParty} -> ${m.toParty} (TxID: ${m.transactionId || 'None'})`,
        m.deduplicationNote,
      ])
    );
  } else {
    drawParagraph('No itemized financial movements recorded in current timeline.');
  }

  // ── 8. Warnings & Anomalies
  drawSectionHeading('7. Warnings and Metadata / Timestamp Anomalies');
  if (model.warnings.length === 0) {
    drawParagraph('None recorded in current case state.');
  } else {
    drawTable(
      [
        { header: 'Severity & Source', width: 112 },
        { header: 'Category & Finding', width: 205 },
        { header: 'Why It Matters (Plain-Language Impact)', width: 215 },
      ],
      model.warnings.map((w) => [
        `[${w.severity}] ${w.sourceRef}`,
        `${w.category}: ${w.whatWasFound}`,
        w.whyItMatters,
      ])
    );
  }

  // ── 9. Integrity & Chain-of-Custody Results
  drawSectionHeading('8. Integrity and Chain-of-Custody Results');
  drawParagraph(model.integrity.scopeSummary);
  drawParagraph(model.integrity.merkleChainStatus, {
    boldPrefix: 'Verification Result:',
  });
  drawParagraph(model.integrity.headMerkleHash, {
    boldPrefix: 'Recorded Chain Root / Latest Hash:',
    font: 'courier',
    fontSize: 8.5,
  });
  drawParagraph(model.integrity.presentationDisclaimer, {
    fontSize: 8.5,
    color: [71, 85, 105],
  });

  if (model.integrity.custodyEntries.length > 0) {
    drawTable(
      [
        { header: 'Seq', width: 34, mono: true },
        { header: 'Timestamp', width: 102, mono: true },
        { header: 'Actor & Action', width: 136 },
        { header: 'Target & Details', width: 150 },
        { header: 'Entry Hash', width: 110, mono: true, maxToken: 22 },
      ],
      model.integrity.custodyEntries.map((ce) => [
        `#${ce.sequenceNumber}`,
        ce.timestamp,
        `${ce.actionType} by ${ce.actor} (${ce.role})`,
        `${ce.targetResource}: ${ce.details}`,
        ce.entryHash,
      ])
    );
  }

  // ── 10. Conclusion, Next Review Points & Glossary
  drawSectionHeading('9. Conclusion and Next Review Points');
  drawParagraph(model.conclusion.summaryStatement);
  model.conclusion.nextReviewPoints.forEach((pt, idx) => {
    drawParagraph(`${idx + 1}. ${pt}`, { indent: 8 });
  });

  drawSectionHeading('10. Technical Glossary');
  model.glossary.forEach((g) => {
    drawParagraph(g.definition, { boldPrefix: `${g.term}:` });
  });

  if (totalSubstitutions > 0) {
    drawParagraph(
      `Font Encoding Note: ${totalSubstitutions} non-Latin character(s) were substituted with safe ASCII equivalents ("?") because standard PDF Type-1 fonts support Latin-1 encoding only.`,
      { fontSize: 8, color: [100, 116, 139] }
    );
  }

  // ── Running Header & Footer with Case ID and "Page X of Y" across all pages
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN_X, 36, PAGE_W - MARGIN_X, 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      cleanText(`CyberFusion X Forensic Dossier  |  Case: ${model.metadata.caseNumber}`),
      MARGIN_X,
      28
    );
    doc.text(
      cleanText(model.metadata.generatedAtUtc.slice(0, 19) + ' UTC'),
      PAGE_W - MARGIN_X,
      28,
      { align: 'right' }
    );

    doc.line(MARGIN_X, PAGE_H - 34, PAGE_W - MARGIN_X, PAGE_H - 34);
    doc.text(
      cleanText(`${model.metadata.caseNumber}  |  ${model.metadata.reportStatus}`),
      MARGIN_X,
      PAGE_H - 20
    );
    doc.text(
      `Page ${p} of ${pageCount}`,
      PAGE_W - MARGIN_X,
      PAGE_H - 20,
      { align: 'right' }
    );
  }

  model.metadata.nonLatinSubstitutionsApplied = totalSubstitutions;
  const arrayBuf = doc.output('arraybuffer');
  return {
    bytes: new Uint8Array(arrayBuf),
    pageCount,
    nonLatinSubstitutions: totalSubstitutions,
  };
}

/**
 * Triggers a browser file download safely with delayed URL revocation (3000ms)
 * so downloads are never cancelled prematurely.
 */
export function triggerSafeBlobDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 3000);
}
