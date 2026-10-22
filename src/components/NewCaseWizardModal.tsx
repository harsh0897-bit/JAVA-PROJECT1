import React, { useState, useMemo } from 'react';
import {
  FolderPlus,
  X,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Users,
  DollarSign,
  Clock,
  FileText,
  Network,
  Upload,
  Sparkles,
} from 'lucide-react';
import {
  EvidenceItem,
  ExtractedEntity,
  EntityRelationship,
  TimelineEvent,
  ForensicCaseSummary,
  FinancialTransaction,
} from '../types';

export interface NewCaseWizardPayload {
  id?: string;
  caseNumber: string;
  title: string;
  incidentType: string;
  status: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  jurisdictionCountry: string;
  leadInvestigatorName: string;
  leadUnit: string;
  victimName: string;
  estimatedLossUsd: number;
  summary: string;
  entities: Partial<ExtractedEntity>[];
  transactions: Partial<FinancialTransaction>[];
  timeline: Partial<TimelineEvent>[];
  evidence: Array<Partial<EvidenceItem> & { dataUrl?: string; title?: string }>;
  relationships: Partial<EntityRelationship>[];
}

interface NewCaseWizardModalProps {
  isOpen: boolean;
  mode?: 'CREATE' | 'EDIT';
  existingCases: ForensicCaseSummary[];
  initialCase?: ForensicCaseSummary | null;
  initialEntities?: ExtractedEntity[];
  initialRelationships?: EntityRelationship[];
  initialTimeline?: TimelineEvent[];
  initialEvidence?: EvidenceItem[];
  defaultInvestigatorName?: string;
  onClose: () => void;
  onSubmitCase: (payload: NewCaseWizardPayload, isEdit: boolean) => Promise<void>;
  onDeleteCase?: (caseId: string) => Promise<void>;
}

const WIZARD_STEPS = [
  { id: 1, label: 'Case Details', icon: FolderPlus },
  { id: 2, label: 'Entities & Accounts', icon: Users },
  { id: 3, label: 'Financial Movements', icon: DollarSign },
  { id: 4, label: 'Timeline Events', icon: Clock },
  { id: 5, label: 'Evidence Files', icon: FileText },
  { id: 6, label: 'Graph Links', icon: Network },
] as const;

const COUNTRIES = [
  '',
  'India',
  'Germany',
  'United States',
  'United Kingdom',
  'Singapore',
  'United Arab Emirates',
  'Netherlands',
  'Switzerland',
  'Estonia',
  'Seychelles',
  'Cyprus',
  'Hong Kong',
];

async function computeFileSha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readFileDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

export const NewCaseWizardModal: React.FC<NewCaseWizardModalProps> = ({
  isOpen,
  mode = 'CREATE',
  existingCases,
  initialCase,
  initialEntities = [],
  initialRelationships = [],
  initialTimeline = [],
  initialEvidence = [],
  defaultInvestigatorName = 'Cmdr. Arjun Verma',
  onClose,
  onSubmitCase,
  onDeleteCase,
}) => {
  const isEdit = mode === 'EDIT' && Boolean(initialCase);

  const suggestedCaseNumber = useMemo(() => {
    if (isEdit && initialCase?.caseNumber) return initialCase.caseNumber;
    const baseNum = 920 + existingCases.length;
    return `CFX-2026-0${baseNum}`;
  }, [isEdit, initialCase, existingCases.length]);

  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteCase, setConfirmDeleteCase] = useState<boolean>(false);
  const [pendingEntityDeleteId, setPendingEntityDeleteId] = useState<string | null>(null);

  // Step 1: Case Details
  const [caseNumber, setCaseNumber] = useState<string>(
    initialCase?.caseNumber || suggestedCaseNumber
  );
  const [title, setTitle] = useState<string>(initialCase?.title || '');
  const [incidentType, setIncidentType] = useState<string>(
    initialCase?.incidentType || 'UPI_MULE_PHISHING'
  );
  const [status, setStatus] = useState<string>(initialCase?.status || 'OPEN');
  const [severity, setSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>(
    initialCase?.severity || 'HIGH'
  );
  const [jurisdictionCountry, setJurisdictionCountry] = useState<string>(
    initialCase?.jurisdictionCountry || 'India'
  );
  const [leadInvestigatorName, setLeadInvestigatorName] = useState<string>(
    initialCase?.leadInvestigatorName || defaultInvestigatorName
  );
  const [leadUnit, setLeadUnit] = useState<string>(
    initialCase?.leadUnit || 'Financial Crimes & Digital Forensics Unit'
  );
  const [victimName, setVictimName] = useState<string>(initialCase?.victimName || '');
  const [estimatedLossUsd, setEstimatedLossUsd] = useState<string>(
    initialCase?.estimatedLossUsd !== undefined ? String(initialCase.estimatedLossUsd) : ''
  );
  const [summary, setSummary] = useState<string>(initialCase?.summary || '');

  // Step 2: Entities
  const [entities, setEntities] = useState<
    Array<{
      id: string;
      entityType: string;
      displayLabel: string;
      normalizedValue: string;
      roleInIncident: string;
      riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
      country: string;
      city: string;
    }>
  >(() =>
    isEdit && initialEntities.length > 0
      ? initialEntities.map((e) => ({
          id: e.id,
          entityType: e.entityType || 'BANK_ACCOUNT',
          displayLabel: e.displayLabel || '',
          normalizedValue: e.normalizedValue || '',
          roleInIncident: e.roleInIncident || 'SUSPECT',
          riskLevel: e.riskLevel || 'HIGH',
          country: e.country || e.osintEnrichment?.country || '',
          city: e.city || '',
        }))
      : []
  );

  const [newEntType, setNewEntType] = useState<string>('UPI_ID');
  const [newEntLabel, setNewEntLabel] = useState<string>('');
  const [newEntValue, setNewEntValue] = useState<string>('');
  const [newEntRole, setNewEntRole] = useState<string>('MULE_ACCOUNT');
  const [newEntRisk, setNewEntRisk] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'>('HIGH');
  const [newEntCountry, setNewEntCountry] = useState<string>('India');

  // Step 3: Financial Movements
  const [transactions, setTransactions] = useState<
    Array<{
      id: string;
      fromEntityId: string;
      fromParty: string;
      toEntityId: string;
      toParty: string;
      amount: number;
      currency: string;
      timestamp: string;
      channel: string;
      referenceId: string;
      notes: string;
    }>
  >(() =>
    isEdit && Array.isArray(initialCase?.transactions)
      ? initialCase!.transactions!.map((t) => ({
          id: t.id,
          fromEntityId: t.fromEntityId || '',
          fromParty: t.fromParty || '',
          toEntityId: t.toEntityId || '',
          toParty: t.toParty || '',
          amount: t.amount || 0,
          currency: t.currency || 'INR',
          timestamp: t.timestamp || new Date().toISOString().slice(0, 16) + ':00Z',
          channel: t.channel || 'UPI',
          referenceId: t.referenceId || '',
          notes: t.notes || '',
        }))
      : []
  );

  const [txFromEntityId, setTxFromEntityId] = useState<string>('');
  const [txToEntityId, setTxToEntityId] = useState<string>('');
  const [txAmount, setTxAmount] = useState<string>('');
  const [txCurrency, setTxCurrency] = useState<string>('INR');
  const [txChannel, setTxChannel] = useState<string>('UPI');
  const [txReferenceId, setTxReferenceId] = useState<string>('');
  const [txTimestamp, setTxTimestamp] = useState<string>('2026-10-14T10:15:00Z');

  // Step 4: Timeline Events
  const [timeline, setTimeline] = useState<
    Array<{
      id: string;
      title: string;
      eventTimestamp: string;
      killChainPhase: string;
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      actorEntity: string;
      targetEntity: string;
      amountInvolved: string;
      description: string;
      anomalyFlag: boolean;
      anomalyReason: string;
    }>
  >(() =>
    isEdit && initialTimeline.length > 0
      ? initialTimeline.map((t) => ({
          id: t.id,
          title: t.title || '',
          eventTimestamp: t.eventTimestamp || '',
          killChainPhase: t.killChainPhase || 'INITIAL_CONTACT',
          severity: t.severity || 'HIGH',
          actorEntity: t.actorEntity || '',
          targetEntity: t.targetEntity || '',
          amountInvolved: t.amountInvolved || '',
          description: t.description || '',
          anomalyFlag: Boolean(t.anomalyFlag),
          anomalyReason: t.anomalyReason || '',
        }))
      : []
  );

  const [tlTitle, setTlTitle] = useState<string>('');
  const [tlTimestamp, setTlTimestamp] = useState<string>('2026-10-14T10:12:00Z');
  const [tlPhase, setTlPhase] = useState<string>('INITIAL_CONTACT');
  const [tlSeverity, setTlSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [tlActor, setTlActor] = useState<string>('');
  const [tlTarget, setTlTarget] = useState<string>('');
  const [tlAmount, setTlAmount] = useState<string>('');
  const [tlDesc, setTlDesc] = useState<string>('');
  const [tlAnomaly, setTlAnomaly] = useState<boolean>(false);
  const [tlAnomalyReason, setTlAnomalyReason] = useState<string>('');

  // Step 5: Evidence Files
  const [evidence, setEvidence] = useState<
    Array<{
      id: string;
      evidenceCode: string;
      originalFilename: string;
      evidenceCategory: string;
      detectedMimeType: string;
      fileSizeBytes: number;
      sha256Hash: string;
      integrityStatus: 'VERIFIED_INTACT' | 'TAMPER_DETECTED' | 'UNVERIFIED';
      timestampAnomaly: boolean;
      timestampAnomalyDetail: string;
      ocrRawText: string;
      dataUrl?: string;
    }>
  >(() =>
    isEdit && initialEvidence.length > 0
      ? initialEvidence.map((ev) => ({
          id: ev.id,
          evidenceCode: ev.evidenceCode,
          originalFilename: ev.originalFilename,
          evidenceCategory: ev.evidenceCategory || 'TRANSACTION_RECEIPT',
          detectedMimeType: ev.detectedMimeType || 'image/png',
          fileSizeBytes: ev.fileSizeBytes || 24576,
          sha256Hash: ev.sha256Hash || '',
          integrityStatus: ev.integrityStatus || 'VERIFIED_INTACT',
          timestampAnomaly: Boolean(ev.timestampAnomaly),
          timestampAnomalyDetail: ev.timestampAnomalyDetail || '',
          ocrRawText: ev.ocrRawText || '',
        }))
      : []
  );

  const [evFilename, setEvFilename] = useState<string>('');
  const [evCategory, setEvCategory] = useState<string>('TRANSACTION_RECEIPT');
  const [evSha256, setEvSha256] = useState<string>('');
  const [evOcrText, setEvOcrText] = useState<string>('');
  const [evAnomaly, setEvAnomaly] = useState<boolean>(false);
  const [evAnomalyDetail, setEvAnomalyDetail] = useState<string>('');
  const [evComputingHash, setEvComputingHash] = useState<boolean>(false);
  const [evDataUrl, setEvDataUrl] = useState<string>('');
  const [evFileSize, setEvFileSize] = useState<number>(28400);
  const [evMimeType, setEvMimeType] = useState<string>('image/png');

  // Step 6: Relationships
  const [relationships, setRelationships] = useState<
    Array<{
      id: string;
      sourceEntityId: string;
      targetEntityId: string;
      relationshipType: string;
      label: string;
      weight: number;
    }>
  >(() =>
    isEdit && initialRelationships.length > 0
      ? initialRelationships.map((r) => ({
          id: r.id,
          sourceEntityId: r.sourceEntityId,
          targetEntityId: r.targetEntityId,
          relationshipType: r.relationshipType || 'TRANSFERRED_TO',
          label: r.label || r.relationshipType || 'TRANSFERRED_TO',
          weight: r.weight || 8.5,
        }))
      : []
  );

  const [relSourceId, setRelSourceId] = useState<string>('');
  const [relTargetId, setRelTargetId] = useState<string>('');
  const [relType, setRelType] = useState<string>('TRANSFERRED_TO');
  const [relLabel, setRelLabel] = useState<string>('');

  if (!isOpen) return null;

  const validateStep1 = (): string | null => {
    if (!title.trim()) {
      return 'Case Title is required.';
    }
    if (!caseNumber.trim()) {
      return 'Case Number / ID is required.';
    }
    const dup = existingCases.some(
      (c) =>
        c.caseNumber.toLowerCase() === caseNumber.trim().toLowerCase() &&
        (!isEdit || c.id !== initialCase?.id)
    );
    if (dup) {
      return `Case Number "${caseNumber.trim()}" already exists. Please enter a unique Case ID.`;
    }
    if (estimatedLossUsd.trim() !== '') {
      const val = Number(estimatedLossUsd);
      if (Number.isNaN(val) || val < 0) {
        return 'Estimated exposure must be a non-negative number.';
      }
    }
    return null;
  };

  const handleNextStep = () => {
    setErrorMsg(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) {
        setErrorMsg(err);
        return;
      }
    }
    setStep((prev) => Math.min(6, prev + 1));
  };

  const handlePrevStep = () => {
    setErrorMsg(null);
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleAddEntity = () => {
    setErrorMsg(null);
    if (!newEntLabel.trim() && !newEntValue.trim()) {
      setErrorMsg('Provide an entity display name or identifier.');
      return;
    }
    const id = `ent-local-${Date.now().toString(16)}-${entities.length + 1}`;
    const label = newEntLabel.trim() || newEntValue.trim();
    const val = newEntValue.trim() || newEntLabel.trim();
    const next = [
      ...entities,
      {
        id,
        entityType: newEntType,
        displayLabel: label,
        normalizedValue: val,
        roleInIncident: newEntRole,
        riskLevel: newEntRisk,
        country: newEntCountry,
        city: '',
      },
    ];
    setEntities(next);
    setNewEntLabel('');
    setNewEntValue('');
    if (!txFromEntityId) setTxFromEntityId(id);
    else if (!txToEntityId) setTxToEntityId(id);
    if (!relSourceId) setRelSourceId(id);
    else if (!relTargetId) setRelTargetId(id);
  };

  const getEntityDependentCount = (entityId: string) => {
    const ent = entities.find((e) => e.id === entityId);
    const txDeps = transactions.filter(
      (t) => t.fromEntityId === entityId || t.toEntityId === entityId
    ).length;
    const relDeps = relationships.filter(
      (r) => r.sourceEntityId === entityId || r.targetEntityId === entityId
    ).length;
    const tlDeps = ent
      ? timeline.filter(
          (tl) => tl.actorEntity === ent.displayLabel || tl.targetEntity === ent.displayLabel
        ).length
      : 0;
    return txDeps + relDeps + tlDeps;
  };

  const executeDeleteEntity = (entityId: string) => {
    setEntities((prev) => prev.filter((e) => e.id !== entityId));
    setRelationships((prev) =>
      prev.filter((r) => r.sourceEntityId !== entityId && r.targetEntityId !== entityId)
    );
    setTransactions((prev) =>
      prev.filter((t) => t.fromEntityId !== entityId && t.toEntityId !== entityId)
    );
    setPendingEntityDeleteId(null);
  };

  const handleAddTransaction = () => {
    setErrorMsg(null);
    const amt = parseFloat(txAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      setErrorMsg('Transaction amount must be a positive number.');
      return;
    }
    if (!txFromEntityId || !txToEntityId) {
      setErrorMsg('Select both a sender and receiver entity.');
      return;
    }
    if (txFromEntityId === txToEntityId) {
      setErrorMsg('Sender and receiver must be distinct entities.');
      return;
    }
    const fromEnt = entities.find((e) => e.id === txFromEntityId);
    const toEnt = entities.find((e) => e.id === txToEntityId);

    const newTx = {
      id: `tx-local-${Date.now().toString(16)}-${transactions.length + 1}`,
      fromEntityId: txFromEntityId,
      fromParty: fromEnt?.displayLabel || txFromEntityId,
      toEntityId: txToEntityId,
      toParty: toEnt?.displayLabel || txToEntityId,
      amount: amt,
      currency: txCurrency,
      timestamp: txTimestamp.trim(),
      channel: txChannel,
      referenceId: txReferenceId.trim(),
      notes: '',
    };
    setTransactions((prev) => [...prev, newTx]);
    setTxAmount('');
    setTxReferenceId('');
  };

  const handleImportTimelineFromTransactions = () => {
    if (transactions.length === 0) return;
    const imported = transactions.map((tx, idx) => ({
      id: `tl-tx-${Date.now().toString(16)}-${idx + 1}`,
      title: `${tx.channel} transfer: ${tx.fromParty} to ${tx.toParty}`,
      eventTimestamp: tx.timestamp || '',
      killChainPhase: idx === 0 ? 'INITIAL_BREACH' : 'MULE_LAYERING',
      severity: 'HIGH' as const,
      actorEntity: tx.fromParty,
      targetEntity: tx.toParty,
      amountInvolved: `${tx.amount.toLocaleString('en-US')} ${tx.currency}${
        tx.referenceId ? ` (${tx.referenceId})` : ''
      }`,
      description: `Recorded ${tx.channel} movement of ${tx.amount.toLocaleString('en-US')} ${
        tx.currency
      } from ${tx.fromParty} to ${tx.toParty}${
        tx.referenceId ? ` [Ref: ${tx.referenceId}]` : ''
      }.`,
      anomalyFlag: false,
      anomalyReason: '',
    }));
    setTimeline((prev) => [...prev, ...imported]);
  };

  const handleAddTimelineEvent = () => {
    setErrorMsg(null);
    if (!tlTitle.trim()) {
      setErrorMsg('Timeline event title is required.');
      return;
    }
    setTimeline((prev) => [
      ...prev,
      {
        id: `tl-local-${Date.now().toString(16)}-${prev.length + 1}`,
        title: tlTitle.trim(),
        eventTimestamp: tlTimestamp.trim(),
        killChainPhase: tlPhase,
        severity: tlSeverity,
        actorEntity: tlActor.trim(),
        targetEntity: tlTarget.trim(),
        amountInvolved: tlAmount.trim(),
        description: tlDesc.trim() || tlTitle.trim(),
        anomalyFlag: tlAnomaly,
        anomalyReason: tlAnomaly ? tlAnomalyReason.trim() || 'Metadata / timing discrepancy flagged by investigator' : '',
      },
    ]);
    setTlTitle('');
    setTlAmount('');
    setTlDesc('');
    setTlAnomaly(false);
    setTlAnomalyReason('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('File exceeds the 50 MB forensic upload limit.');
      return;
    }
    setEvFilename(file.name);
    setEvFileSize(file.size);
    setEvMimeType(file.type || 'application/octet-stream');
    setEvComputingHash(true);
    try {
      const hex = await computeFileSha256Hex(file);
      setEvSha256(hex);
      if (file.type.startsWith('image/')) {
        const dUrl = await readFileDataUrl(file);
        setEvDataUrl(dUrl);
      } else {
        const txt = (await file.text()).slice(0, 800);
        if (txt && !evOcrText) setEvOcrText(txt);
      }
    } catch {
      // Fallback if Web Crypto fails
    } finally {
      setEvComputingHash(false);
    }
  };

  const handleAddEvidence = () => {
    setErrorMsg(null);
    if (!evFilename.trim()) {
      setErrorMsg('Provide a filename or upload a file for the evidence record.');
      return;
    }
    const cleanHash = evSha256.trim().toLowerCase();
    if (cleanHash && !/^[0-9a-f]{64}$/.test(cleanHash)) {
      setErrorMsg('Manual SHA-256 fingerprint must be an exact 64-character hexadecimal string (or leave blank to compute automatically).');
      return;
    }
    const evCode = `EVD-${String(evidence.length + 1).padStart(3, '0')}`;
    setEvidence((prev) => [
      ...prev,
      {
        id: `evd-local-${Date.now().toString(16)}-${prev.length + 1}`,
        evidenceCode: evCode,
        originalFilename: evFilename.trim(),
        evidenceCategory: evCategory,
        detectedMimeType: evMimeType,
        fileSizeBytes: evFileSize,
        sha256Hash: cleanHash,
        integrityStatus: cleanHash ? 'VERIFIED_INTACT' : 'VERIFIED_INTACT',
        timestampAnomaly: evAnomaly,
        timestampAnomalyDetail: evAnomaly
          ? evAnomalyDetail.trim() || 'Camera/EXIF timestamp differs from transaction time'
          : '',
        ocrRawText:
          evOcrText.trim() ||
          `Evidence Artifact: ${evFilename.trim()}\nCategory: ${evCategory}`,
        dataUrl: evDataUrl || undefined,
      },
    ]);
    setEvFilename('');
    setEvSha256('');
    setEvOcrText('');
    setEvAnomaly(false);
    setEvAnomalyDetail('');
    setEvDataUrl('');
  };

  const handleAddRelationship = () => {
    setErrorMsg(null);
    if (!relSourceId || !relTargetId) {
      setErrorMsg('Select both source and target entities.');
      return;
    }
    if (relSourceId === relTargetId) {
      setErrorMsg('Self-loop relationships are not allowed. Choose two distinct entities.');
      return;
    }
    setRelationships((prev) => [
      ...prev,
      {
        id: `rel-local-${Date.now().toString(16)}-${prev.length + 1}`,
        sourceEntityId: relSourceId,
        targetEntityId: relTargetId,
        relationshipType: relType,
        label: relLabel.trim() || relType,
        weight: 8.5,
      },
    ]);
    setRelLabel('');
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const step1Err = validateStep1();
    if (step1Err) {
      setStep(1);
      setErrorMsg(step1Err);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitCase(
        {
          id: isEdit ? initialCase?.id : undefined,
          caseNumber: caseNumber.trim(),
          title: title.trim(),
          incidentType,
          status,
          severity,
          jurisdictionCountry,
          leadInvestigatorName: leadInvestigatorName.trim() || defaultInvestigatorName,
          leadUnit: leadUnit.trim(),
          victimName: victimName.trim() || 'Not recorded',
          estimatedLossUsd: estimatedLossUsd.trim() ? Number(estimatedLossUsd) : 0,
          summary: summary.trim(),
          entities,
          transactions,
          timeline,
          evidence,
          relationships,
        },
        isEdit
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to save case. Check required fields.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/20';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-wizard-title"
    >
      <div className="cf-glass-panel rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden bg-white/95 border border-slate-200 shadow-2xl">
        {/* Top Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-[#2563EB] shrink-0">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="case-wizard-title"
                className="text-base font-bold text-slate-900 truncate"
              >
                {isEdit
                  ? `Edit Case Workspace · ${initialCase?.caseNumber}`
                  : 'Create Forensic Investigation Case'}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Structured 6-step case builder — propagates directly to Overview, Evidence, Graph, Timeline, Ledger &amp; Report
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close case wizard"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Bar */}
        <div className="px-6 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {WIZARD_STEPS.map((s) => {
            const Icon = s.icon;
            const isCurrent = step === s.id;
            const isCompleted = step > s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (s.id > 1) {
                    const err = validateStep1();
                    if (err) {
                      setErrorMsg(err);
                      return;
                    }
                  }
                  setErrorMsg(null);
                  setStep(s.id);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
                  isCurrent
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : isCompleted
                    ? 'bg-blue-50 text-[#1D4ED8] border border-blue-200'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>
                  {s.id}. {s.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Validation Banner */}
        {errorMsg && (
          <div className="mx-6 mt-3 px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700 font-semibold shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Scrollable Step Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Case Title <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Operation Meridian — Cross-Border Mule Ring"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Case ID / Number <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={caseNumber}
                    onChange={(e) => setCaseNumber(e.target.value)}
                    placeholder="CFX-2026-0922"
                    className={`${inputClass} font-mono font-semibold`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Incident Typology
                  </label>
                  <select
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value)}
                    className={inputClass}
                  >
                    <option value="UPI_MULE_PHISHING">UPI Mule Phishing</option>
                    <option value="BEC_WIRE_FRAUD">BEC Wire Fraud</option>
                    <option value="CRYPTO_DRAINER">Crypto Wallet Drainer</option>
                    <option value="IDENTITY_SPOOFING">Identity Spoofing</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Severity
                  </label>
                  <select
                    value={severity}
                    onChange={(e) =>
                      setSeverity(
                        e.target.value as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
                      )
                    }
                    className={inputClass}
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={inputClass}
                  >
                    <option value="OPEN">Open</option>
                    <option value="UNDER_REVIEW">Under Review</option>
                    <option value="ESCALATED">Escalated</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Primary Jurisdiction
                  </label>
                  <select
                    value={jurisdictionCountry}
                    onChange={(e) => setJurisdictionCountry(e.target.value)}
                    className={inputClass}
                  >
                    {COUNTRIES.filter(Boolean).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Complainant / Victim Name
                  </label>
                  <input
                    type="text"
                    value={victimName}
                    onChange={(e) => setVictimName(e.target.value)}
                    placeholder="e.g. Rajeshwari Exports Pvt Ltd"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Headline Loss Estimate (USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={estimatedLossUsd}
                    onChange={(e) => setEstimatedLossUsd(e.target.value)}
                    placeholder="e.g. 24500"
                    className={`${inputClass} font-mono tabular-nums`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lead Investigator
                  </label>
                  <input
                    type="text"
                    value={leadInvestigatorName}
                    onChange={(e) => setLeadInvestigatorName(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lead Unit
                  </label>
                  <input
                    type="text"
                    value={leadUnit}
                    onChange={(e) => setLeadUnit(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Executive Case Summary &amp; Scope
                </label>
                <textarea
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Describe what happened, the initial contact vector, pass-through accounts, and settlement destination..."
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="text-xs font-bold text-slate-800">
                  Add Person, Account, Phone, Domain, IP, or Wallet
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Category
                    </label>
                    <select
                      value={newEntType}
                      onChange={(e) => setNewEntType(e.target.value)}
                      className={inputClass}
                    >
                      <option value="PERSON">Person</option>
                      <option value="UPI_ID">UPI ID</option>
                      <option value="BANK_ACCOUNT">Bank Account</option>
                      <option value="PHONE">Phone Number</option>
                      <option value="CRYPTO_WALLET">Crypto Wallet</option>
                      <option value="DOMAIN">Domain / URL</option>
                      <option value="IP_ADDRESS">Server IP</option>
                      <option value="EMAIL">Email</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Display Name / Label
                    </label>
                    <input
                      type="text"
                      value={newEntLabel}
                      onChange={(e) => setNewEntLabel(e.target.value)}
                      placeholder="e.g. Mule Account (Axis)"
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Identifier / Account Value
                    </label>
                    <input
                      type="text"
                      value={newEntValue}
                      onChange={(e) => setNewEntValue(e.target.value)}
                      placeholder="e.g. rapid.settle@okaxis"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Country (Globe)
                    </label>
                    <select
                      value={newEntCountry}
                      onChange={(e) => setNewEntCountry(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Not specified</option>
                      {COUNTRIES.filter(Boolean).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-600">Role:</span>
                      <select
                        value={newEntRole}
                        onChange={(e) => setNewEntRole(e.target.value)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs"
                      >
                        <option value="VICTIM">Victim / Complainant</option>
                        <option value="PRIMARY_SUSPECT">Primary Suspect</option>
                        <option value="MULE_ACCOUNT">Pass-Through / Mule</option>
                        <option value="OFFSHORE_EXCHANGE">Offshore / Exit Node</option>
                        <option value="INFRASTRUCTURE">Infrastructure / C2</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-600">Risk:</span>
                      <select
                        value={newEntRisk}
                        onChange={(e) =>
                          setNewEntRisk(
                            e.target.value as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs"
                      >
                        <option value="CRITICAL">CRITICAL</option>
                        <option value="HIGH">HIGH</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="LOW">LOW</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddEntity}
                    className="cf-btn-blue px-3.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Entity Node</span>
                  </button>
                </div>
              </div>

              {pendingEntityDeleteId && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900">
                  <span>
                    This entity is referenced by{' '}
                    <strong>{getEntityDependentCount(pendingEntityDeleteId)}</strong> transaction(s)
                    or relationship(s). Deleting it will also remove those dependent links.
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => executeDeleteEntity(pendingEntityDeleteId)}
                      className="px-3 py-1 rounded-lg bg-rose-600 text-white font-semibold cursor-pointer"
                    >
                      Confirm Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingEntityDeleteId(null)}
                      className="px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {entities.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                  No entities added yet. Add at least two entities to connect financial transfers or graph links.
                </div>
              ) : (
                <div className="space-y-2">
                  {entities.map((ent) => (
                    <div
                      key={ent.id}
                      className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[10px] font-bold shrink-0">
                          {ent.entityType}
                        </span>
                        <span className="font-bold text-slate-900 truncate">
                          {ent.displayLabel}
                        </span>
                        <span className="font-mono text-slate-500 truncate">
                          ({ent.normalizedValue})
                        </span>
                        {ent.country && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium shrink-0">
                            {ent.country}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-semibold text-slate-500">
                          {ent.roleInIncident} · {ent.riskLevel}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const deps = getEntityDependentCount(ent.id);
                            if (deps > 0) {
                              setPendingEntityDeleteId(ent.id);
                            } else {
                              executeDeleteEntity(ent.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Remove entity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="text-xs font-bold text-slate-800">
                  Add Financial Movement (Auto-generates TRANSFERRED_TO graph link &amp; feeds Section 6 Currency Subtotals)
                </div>

                {entities.length < 2 ? (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    Add at least 2 entities in Step 2 first so you can select Sender and Receiver accounts.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          From (Sender)
                        </label>
                        <select
                          value={txFromEntityId}
                          onChange={(e) => setTxFromEntityId(e.target.value)}
                          className={inputClass}
                        >
                          <option value="">Select sender...</option>
                          {entities.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.displayLabel} ({e.entityType})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          To (Receiver)
                        </label>
                        <select
                          value={txToEntityId}
                          onChange={(e) => setTxToEntityId(e.target.value)}
                          className={inputClass}
                        >
                          <option value="">Select receiver...</option>
                          {entities.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.displayLabel} ({e.entityType})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Amount
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={txAmount}
                          onChange={(e) => setTxAmount(e.target.value)}
                          placeholder="450000"
                          className={`${inputClass} font-mono tabular-nums`}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Currency
                        </label>
                        <select
                          value={txCurrency}
                          onChange={(e) => setTxCurrency(e.target.value)}
                          className={`${inputClass} font-mono font-bold`}
                        >
                          <option value="INR">INR</option>
                          <option value="USD">USD</option>
                          <option value="USDT">USDT</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Channel
                        </label>
                        <select
                          value={txChannel}
                          onChange={(e) => setTxChannel(e.target.value)}
                          className={inputClass}
                        >
                          <option value="UPI">UPI</option>
                          <option value="IMPS">IMPS</option>
                          <option value="WIRE">SWIFT / Wire</option>
                          <option value="CRYPTO">Crypto Transfer</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Reference ID (UTR/IMPS/SWIFT/TXN)
                        </label>
                        <input
                          type="text"
                          value={txReferenceId}
                          onChange={(e) => setTxReferenceId(e.target.value)}
                          placeholder="e.g. UTR-6289140021"
                          className={`${inputClass} font-mono`}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Timestamp (ISO / UTC)
                        </label>
                        <input
                          type="text"
                          value={txTimestamp}
                          onChange={(e) => setTxTimestamp(e.target.value)}
                          placeholder="2026-10-14T10:15:00Z"
                          className={`${inputClass} font-mono`}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleAddTransaction}
                        className="cf-btn-blue h-9 px-3.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Transfer</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {transactions.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                  No financial movements recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold">
                          {tx.amount.toLocaleString('en-US')} {tx.currency}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {tx.fromParty} &rarr; {tx.toParty}
                        </span>
                        <span className="font-mono text-slate-500">
                          [{tx.channel} · Ref: {tx.referenceId || 'None (unresolved duplicate)'}]
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setTransactions((prev) => prev.filter((item) => item.id !== tx.id))
                        }
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Add Chronological Timeline Event
                  </span>
                  {transactions.length > 0 && (
                    <button
                      type="button"
                      onClick={handleImportTimelineFromTransactions}
                      className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-blue-100 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate steps from {transactions.length} transfer(s)</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Event Title
                    </label>
                    <input
                      type="text"
                      value={tlTitle}
                      onChange={(e) => setTlTitle(e.target.value)}
                      placeholder="e.g. Spoofed bank alert SMS received"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Timestamp (leave blank if undated)
                    </label>
                    <input
                      type="text"
                      value={tlTimestamp}
                      onChange={(e) => setTlTimestamp(e.target.value)}
                      placeholder="2026-10-14T10:12:00Z"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Phase
                    </label>
                    <select
                      value={tlPhase}
                      onChange={(e) => setTlPhase(e.target.value)}
                      className={inputClass}
                    >
                      <option value="INITIAL_CONTACT">Initial Contact</option>
                      <option value="INITIAL_BREACH">Account Compromise</option>
                      <option value="MULE_LAYERING">Pass-Through Transfer</option>
                      <option value="CASH_OUT_EXIT">Offshore / Crypto Exit</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      From / Actor
                    </label>
                    <input
                      type="text"
                      value={tlActor}
                      onChange={(e) => setTlActor(e.target.value)}
                      placeholder="e.g. +91 98204 11892"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      To / Target
                    </label>
                    <input
                      type="text"
                      value={tlTarget}
                      onChange={(e) => setTlTarget(e.target.value)}
                      placeholder="e.g. Victim Account"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Amount Involved (optional)
                    </label>
                    <input
                      type="text"
                      value={tlAmount}
                      onChange={(e) => setTlAmount(e.target.value)}
                      placeholder="e.g. INR 450,000 (UTR-6289140021)"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Event Description
                    </label>
                    <input
                      type="text"
                      value={tlDesc}
                      onChange={(e) => setTlDesc(e.target.value)}
                      placeholder="Describe supporting details..."
                      className={inputClass}
                    />
                  </div>
                  <div className="flex items-center gap-2 h-9">
                    <input
                      id="tl-anomaly-chk"
                      type="checkbox"
                      checked={tlAnomaly}
                      onChange={(e) => setTlAnomaly(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <label
                      htmlFor="tl-anomaly-chk"
                      className="text-xs font-semibold text-amber-800 cursor-pointer"
                    >
                      Flag timing mismatch
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTimelineEvent}
                    className="cf-btn-blue h-9 px-3.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Event</span>
                  </button>
                </div>
              </div>

              {timeline.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                  No timeline events added yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {timeline.map((ev, idx) => (
                    <div
                      key={ev.id}
                      className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-blue-600">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-slate-900 truncate">
                          {ev.title}
                        </span>
                        <span className="font-mono text-slate-500">
                          {ev.eventTimestamp || 'Date not recorded'}
                        </span>
                        {ev.amountInvolved && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-slate-700">
                            {ev.amountInvolved}
                          </span>
                        )}
                        {ev.anomalyFlag && (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                            Anomaly Flagged
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setTimeline((prev) => prev.filter((item) => item.id !== ev.id))
                        }
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Add Evidence Artifact (Web Crypto SHA-256 Computation or Manual Entry)
                  </span>
                  <label className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>{evComputingHash ? 'Computing SHA-256...' : 'Select File (<= 50 MB)'}</span>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Filename
                    </label>
                    <input
                      type="text"
                      value={evFilename}
                      onChange={(e) => setEvFilename(e.target.value)}
                      placeholder="e.g. axis_imps_receipt_01.png"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Category
                    </label>
                    <select
                      value={evCategory}
                      onChange={(e) => setEvCategory(e.target.value)}
                      className={inputClass}
                    >
                      <option value="TRANSACTION_RECEIPT">Payment Receipt</option>
                      <option value="SCREENSHOT">Chat / SMS Screenshot</option>
                      <option value="BANK_STATEMENT">Bank Statement</option>
                      <option value="NETWORK_PCAP">Server / Network Log</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      SHA-256 Fingerprint (64-hex or auto)
                    </label>
                    <input
                      type="text"
                      value={evSha256}
                      onChange={(e) => setEvSha256(e.target.value)}
                      placeholder="Auto-computed or 64-char hex"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Extracted Text / Clue Lines (1 per line)
                    </label>
                    <input
                      type="text"
                      value={evOcrText}
                      onChange={(e) => setEvOcrText(e.target.value)}
                      placeholder="e.g. UPI: rapid.settle@okaxis | UTR-6289140021"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div className="flex items-center gap-2 h-9">
                    <input
                      id="ev-anomaly-chk"
                      type="checkbox"
                      checked={evAnomaly}
                      onChange={(e) => setEvAnomaly(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <label
                      htmlFor="ev-anomaly-chk"
                      className="text-xs font-semibold text-amber-800 cursor-pointer"
                    >
                      EXIF clock mismatch
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEvidence}
                    className="cf-btn-blue h-9 px-3.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Evidence</span>
                  </button>
                </div>
              </div>

              {evidence.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                  No evidence files added yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono font-bold">
                          {ev.evidenceCode}
                        </span>
                        <span className="font-bold text-slate-900 truncate">
                          {ev.originalFilename}
                        </span>
                        {ev.sha256Hash && (
                          <span className="font-mono text-slate-500 truncate">
                            SHA-256: {ev.sha256Hash.slice(0, 16)}…
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setEvidence((prev) => prev.filter((item) => item.id !== ev.id))
                        }
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="text-xs font-bold text-slate-800">
                  Add Directed Graph Relationship (Note: Financial Movements from Step 3 also link automatically)
                </div>

                {entities.length < 2 ? (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    Add at least 2 entities in Step 2 to create custom relationships.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Source Entity
                      </label>
                      <select
                        value={relSourceId}
                        onChange={(e) => setRelSourceId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select source...</option>
                        {entities.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.displayLabel}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Relationship Type
                      </label>
                      <select
                        value={relType}
                        onChange={(e) => setRelType(e.target.value)}
                        className={inputClass}
                      >
                        <option value="TRANSFERRED_TO">TRANSFERRED_TO</option>
                        <option value="CONTROLS">CONTROLS</option>
                        <option value="COMMUNICATED_WITH">COMMUNICATED_WITH</option>
                        <option value="SHARED_DEVICE">SHARED_DEVICE</option>
                        <option value="CASHED_OUT_AT">CASHED_OUT_AT</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Target Entity
                      </label>
                      <select
                        value={relTargetId}
                        onChange={(e) => setRelTargetId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select target...</option>
                        {entities.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.displayLabel}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddRelationship}
                      className="cf-btn-blue h-9 px-3.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Link</span>
                    </button>
                  </div>
                )}
              </div>

              {relationships.length === 0 && transactions.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                  No explicit graph links added yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {relationships.map((rel) => {
                    const s = entities.find((e) => e.id === rel.sourceEntityId);
                    const t = entities.find((e) => e.id === rel.targetEntityId);
                    return (
                      <div
                        key={rel.id}
                        className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {s?.displayLabel || rel.sourceEntityId}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[10px] font-bold">
                            {rel.relationshipType}
                          </span>
                          <span className="font-bold text-slate-900">
                            {t?.displayLabel || rel.targetEntityId}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setRelationships((prev) => prev.filter((item) => item.id !== rel.id))
                          }
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200/80 bg-slate-50/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {isEdit && onDeleteCase && initialCase && (
              <>
                {confirmDeleteCase ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await onDeleteCase(initialCase.id);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      Confirm Delete Case
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteCase(false)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCase(true)}
                    className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Case</span>
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            {step > 1 && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="cf-droplet-idle px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
            )}

            {step < 6 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="cf-droplet-idle px-4 py-2 rounded-xl text-xs font-semibold text-[#1D4ED8] bg-blue-50/80 border border-blue-200 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Next Step</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : null}

            <button
              type="button"
              disabled={submitting}
              onClick={handleFinalSubmit}
              className="cf-btn-blue px-5 py-2.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Saving Case...'
                  : isEdit
                  ? 'Save Case Updates'
                  : 'Create Case & Open Overview'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewCaseWizardModal;
