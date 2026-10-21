import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Upload,
  ShieldCheck,
  ShieldAlert,
  FileText,
  ScanLine,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Lock,
  ZoomIn,
  ZoomOut,
  Plus,
  Search,
  Copy,
  Check,
  ExternalLink,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  EvidenceItem,
  ExtractedEntity,
  ChainOfCustodyEntry,
} from '../types';
import { copyToClipboardSafe } from '../lib/clipboard';
import { DropletTabs, DropletTabItem } from './ui/DropletTabs';

interface EvidenceVaultViewProps {
  caseId: string;
  evidenceList: EvidenceItem[];
  entities?: ExtractedEntity[];
  ledger?: ChainOfCustodyEntry[];
  selectedEvidenceId: string | null;
  onSelectEvidence: (id: string) => void;
  onUploadFile: (
    file: File,
    category: string,
    notes: string,
    clientSha256: string
  ) => Promise<void>;
  onQuickIngest: (title: string, category: string, content: string) => Promise<void>;
  onVerifyIntegrity: (evidenceId: string) => Promise<void>;
  onSimulateTamper: (evidenceId: string, tamper: boolean) => Promise<void>;
  userRole: string;
}

const PRESET_TEMPLATES = [
  {
    label: 'Preset 1: Crypto Transfer Receipt',
    title: 'Binance P2P / Tron USDT Cashout Receipt',
    category: 'TRANSACTION_RECEIPT',
    content: [
      'CRYPTO P2P SETTLEMENT RECEIPT — TXN-USDT-9940218',
      'Timestamp: 2026-10-01T10:52:19Z',
      'Source Mule UPI: fast.liquidity.hub@ybl',
      'Operator: Vikram Singh (Mule L1)',
      'Beneficiary Wallet: TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
      'Secondary Wallet: 0x99B44123EC7ab88b098defB751B7401B5f6d1122',
      'Amount Converted: $9,200.00 USDT',
      'Coordinator Phone: +919876509911',
      'Exit Node IP: 185.220.101.44',
    ].join('\n'),
  },
  {
    label: 'Preset 2: Fake Bank Text Message',
    title: 'Follow-Up Vishing & OTP Interception Log',
    category: 'SMS_SCREENSHOT',
    content: [
      'SMS & VISHING TRANSCRIPT — 2026-10-01T10:19:00Z',
      'Caller Phone: +91-98204-11290',
      'Backup Phone: +91-98765-09911',
      'Phishing Portal: https://hdfc-kyc-update-in.com/auth/session-verify',
      'Target Victim: Arjun Mehta (arjun.mehta@finserve-india.in)',
      'Beneficiary VPA: apex.verify.settlement@okaxis',
      'Relay IP: 185.220.101.44',
    ].join('\n'),
  },
];

type FileFilterGroup = 'ALL' | 'SCREENSHOTS' | 'EMAILS' | 'BANK';
type InspectorTabId = 'TEXT' | 'FINGERPRINT' | 'HISTORY';

const FILE_FILTER_TABS: DropletTabItem[] = [
  { id: 'ALL', label: 'All' },
  { id: 'SCREENSHOTS', label: 'Screenshots' },
  { id: 'EMAILS', label: 'Emails' },
  { id: 'BANK', label: 'Bank' },
];

const INSPECTOR_TABS: DropletTabItem[] = [
  { id: 'TEXT', label: 'Text found' },
  { id: 'FINGERPRINT', label: 'Fingerprint' },
  { id: 'HISTORY', label: 'History' },
];

async function computeBrowserSha256(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return '';
  }
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function matchesFileFilterGroup(ev: EvidenceItem, group: FileFilterGroup): boolean {
  if (group === 'ALL') return true;
  const cat = (ev.evidenceCategory || '').toUpperCase();
  const name = (ev.originalFilename || '').toLowerCase();
  if (group === 'SCREENSHOTS') {
    return (
      cat.includes('SCREENSHOT') ||
      cat.includes('SMS') ||
      cat.includes('CHAT') ||
      name.includes('sms') ||
      name.includes('capture')
    );
  }
  if (group === 'EMAILS') {
    return (
      cat.includes('EMAIL') ||
      cat.includes('PHISH') ||
      cat.includes('NETWORK') ||
      name.includes('email') ||
      name.includes('mitm') ||
      name.includes('session')
    );
  }
  if (group === 'BANK') {
    return (
      cat.includes('RECEIPT') ||
      cat.includes('TRANSACTION') ||
      cat.includes('BANK') ||
      cat.includes('WIRE') ||
      name.includes('upi') ||
      name.includes('bank') ||
      name.includes('usdt') ||
      name.includes('receipt')
    );
  }
  return true;
}

const HEX_CHARS = '0123456789abcdef';

export const EvidenceVaultView: React.FC<EvidenceVaultViewProps> = ({
  evidenceList,
  ledger = [],
  selectedEvidenceId,
  onSelectEvidence,
  onUploadFile,
  onQuickIngest,
  onVerifyIntegrity,
  onSimulateTamper,
}) => {
  // Left file list filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fileFilter, setFileFilter] = useState<FileFilterGroup>('ALL');

  // Viewer state
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [hoveredBoxId, setHoveredBoxId] = useState<string | null>(null);
  const [imgLoadError, setImgLoadError] = useState<boolean>(false);

  // Right Inspector state (3 tabs: Text found | Fingerprint | History)
  const [inspectorTab, setInspectorTab] = useState<InspectorTabId>('TEXT');
  const [showFullFingerprint, setShowFullFingerprint] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 400ms monospace scramble + SVG check draw state for "Verify again"
  const [isVerifyingAgain, setIsVerifyingAgain] = useState<boolean>(false);
  const [scrambledHash, setScrambledHash] = useState<string | null>(null);
  const [showVerifiedCheckDraw, setShowVerifiedCheckDraw] = useState<boolean>(false);
  const scrambleRafRef = useRef<number | null>(null);

  // Upload / Add Evidence modal state
  const [showIngestDrawer, setShowIngestDrawer] = useState<boolean>(false);
  const [quickTitle, setQuickTitle] = useState<string>(PRESET_TEMPLATES[0].title);
  const [quickCategory, setQuickCategory] = useState<string>(PRESET_TEMPLATES[0].category);
  const [quickContent, setQuickContent] = useState<string>(PRESET_TEMPLATES[0].content);
  const [uploadCategory, setUploadCategory] = useState<string>('TRANSACTION_RECEIPT');
  const [uploadNotes, setUploadNotes] = useState<string>(
    'Evidence file locked with SHA-256 fingerprint on upload.'
  );
  const [busyAction, setBusyAction] = useState<boolean>(false);

  // Currently selected evidence item
  const selectedEvidence = useMemo(() => {
    return (
      evidenceList.find((e) => e.id === selectedEvidenceId) ||
      evidenceList[0] ||
      null
    );
  }, [evidenceList, selectedEvidenceId]);

  useEffect(() => {
    setImgLoadError(false);
    setSelectedBoxId(null);
    setHoveredBoxId(null);
    setScrambledHash(null);
    setShowVerifiedCheckDraw(false);
  }, [selectedEvidence?.id]);

  useEffect(() => {
    return () => {
      if (scrambleRafRef.current !== null) {
        cancelAnimationFrame(scrambleRafRef.current);
      }
    };
  }, []);

  const filteredEvidenceList = useMemo(() => {
    return evidenceList.filter((ev) => {
      if (!matchesFileFilterGroup(ev, fileFilter)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = (ev.evidenceCode || '').toLowerCase().includes(q);
        const matchesName = (ev.originalFilename || '').toLowerCase().includes(q);
        const matchesHash = (ev.sha256Hash || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesHash) return false;
      }
      return true;
    });
  }, [evidenceList, fileFilter, searchQuery]);

  // Custody history for the selected file
  const artifactCustodyLedger = useMemo(() => {
    if (!selectedEvidence) return [];
    const code = selectedEvidence.evidenceCode || '';
    const fname = selectedEvidence.originalFilename || '';
    const matching = ledger.filter(
      (entry) =>
        (code && entry.targetResource.includes(code)) ||
        entry.targetResource.includes(selectedEvidence.id) ||
        (code && entry.details.includes(code)) ||
        (fname && entry.details.includes(fname))
    );
    return matching.length > 0 ? matching : ledger.slice(0, 4);
  }, [ledger, selectedEvidence]);

  const handleCopyText = async (text: string, key: string) => {
    if (await copyToClipboardSafe(text)) {
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 1800);
    }
  };

  // 400ms monospace scramble resolving left-to-right to the real value, then SVG green check stroke
  const handleVerifyAgain = async () => {
    if (!selectedEvidence || isVerifyingAgain) return;
    setIsVerifyingAgain(true);
    setShowVerifiedCheckDraw(false);

    const targetHash =
      selectedEvidence.sha256Hash ||
      '9a3f2b18c4e5d6a7890123456789abcdef0123456789abcdef0123456789abcd';
    const displayLen = showFullFingerprint ? targetHash.length : 20;
    const realSlice = showFullFingerprint
      ? targetHash
      : `${targetHash.slice(0, 12)}…${targetHash.slice(-6)}`;

    const duration = 400;
    const startTime = performance.now();

    const stepScramble = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const resolvedChars = Math.floor(progress * displayLen);

      let out = '';
      for (let i = 0; i < realSlice.length; i++) {
        if (realSlice[i] === '…' || i < resolvedChars) {
          out += realSlice[i];
        } else {
          out += HEX_CHARS[Math.floor(Math.random() * 16)];
        }
      }
      setScrambledHash(out);

      if (progress < 1) {
        scrambleRafRef.current = requestAnimationFrame(stepScramble);
      } else {
        setScrambledHash(null);
        setShowVerifiedCheckDraw(true);
      }
    };

    scrambleRafRef.current = requestAnimationFrame(stepScramble);

    try {
      await onVerifyIntegrity(selectedEvidence.id);
    } finally {
      setTimeout(() => {
        setIsVerifyingAgain(false);
      }, 420);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusyAction(true);
    try {
      const clientSha = await computeBrowserSha256(file);
      await onUploadFile(file, uploadCategory, uploadNotes, clientSha);
      setShowIngestDrawer(false);
    } finally {
      setBusyAction(false);
      e.target.value = '';
    }
  };

  const handleQuickIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || !quickContent.trim()) return;
    setBusyAction(true);
    try {
      await onQuickIngest(quickTitle, quickCategory, quickContent);
      setShowIngestDrawer(false);
    } finally {
      setBusyAction(false);
    }
  };

  const formatPlainEntityType = (t: string): string => {
    switch (t) {
      case 'URL':
      case 'DOMAIN':
        return 'Website link';
      case 'IP_ADDRESS':
        return 'Server IP';
      case 'CRYPTO_WALLET':
        return 'Crypto wallet';
      case 'BANK_ACCOUNT':
        return 'Bank account';
      case 'UPI_ID':
        return 'Payment ID';
      case 'TRANSACTION_ID':
        return 'Transfer ref';
      case 'PHONE':
        return 'Phone number';
      case 'PERSON':
        return 'Person';
      case 'EMAIL':
        return 'Email';
      default:
        return t.replace(/_/g, ' ');
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 lg:px-8 pb-12 space-y-5 min-w-0">
      <style>{`
        @keyframes cfDrawCheck {
          from { stroke-dashoffset: 28; }
          to { stroke-dashoffset: 0; }
        }
        .cf-check-stroke {
          stroke-dasharray: 28;
          stroke-dashoffset: 0;
          animation: cfDrawCheck 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 font-mono">
            2 · Evidence Files
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Uploaded Evidence &amp; Extracted Text
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Inspect screenshots, emails, and bank receipts. Hover any highlight box to match it with the extracted text on the right.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowIngestDrawer(true)}
          className="cf-btn-blue h-10 px-4 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add evidence file</span>
        </button>
      </div>

      {/* ── 3-Column Layout: [Left File List] + [Centre Light Viewer] + [Right Inspector] ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[310px_minmax(0,1fr)_380px] gap-6 items-start min-w-0">
        {/* ===================================================================
            COLUMN 1: LEFT LIST OF FILES (Shared Spring Switcher)
            =================================================================== */}
        <aside className="cf-card p-4 space-y-3.5 min-w-0 self-start">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              Evidence files ({filteredEvidenceList.length})
            </h2>
            <span className="text-[11px] font-medium text-emerald-700 bg-[#E7F6EF] px-2 py-0.5 rounded-full">
              All locked
            </span>
          </div>

          {/* Shared Spring Switcher: All / Screenshots / Emails / Bank */}
          <DropletTabs
            variant="compact"
            ariaLabel="Filter evidence files by category"
            idPrefix="evidence-filter"
            items={FILE_FILTER_TABS}
            value={fileFilter}
            onChange={(id) => setFileFilter(id as FileFilterGroup)}
            className="w-full justify-between"
          />

          {/* Search input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search filename or code..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#F6F8FC] border border-slate-200/80 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* File cards */}
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-0.5 min-w-0">
            {filteredEvidenceList.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No evidence files match this filter.
              </div>
            ) : (
              filteredEvidenceList.map((ev) => {
                const isSelected = selectedEvidence?.id === ev.id;
                const isIntact = ev.integrityStatus === 'VERIFIED_INTACT';
                const hasPhotoEditWarning = !!ev.timestampAnomaly;

                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onSelectEvidence(ev.id)}
                    className={`w-full text-left p-3 rounded-2xl border transition cursor-pointer space-y-1.5 min-w-0 ${
                      isSelected
                        ? 'bg-[#EEF4FF] border-blue-400 shadow-2xs'
                        : 'bg-white hover:bg-[#F6F8FC] border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200/70 px-2 py-0.5 rounded-md shrink-0">
                        {ev.evidenceCode}
                      </span>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasPhotoEditWarning && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEF3DF] text-[#9A5B13]">
                            Edited photo
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isIntact
                              ? 'bg-[#E7F6EF] text-[#0E6B45]'
                              : 'bg-[#FDECEC] text-[#B42318]'
                          }`}
                        >
                          <Lock className="w-2.5 h-2.5" />
                          <span>{isIntact ? 'Locked' : 'Changed'}</span>
                        </span>
                      </div>
                    </div>

                    <div
                      className="text-xs font-semibold text-slate-900 break-words leading-snug"
                      title={ev.originalFilename}
                    >
                      {ev.originalFilename}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>{ev.boundingBoxes?.length || 0} text items</span>
                      <span className="font-mono tabular-nums">
                        {formatBytes(ev.fileSizeBytes || 184500)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ===================================================================
            COLUMN 2: CENTRE LIGHT VIEWER (No dark stage, no laser, no 2.5D)
            =================================================================== */}
        <section className="cf-card overflow-hidden flex flex-col min-w-0 self-start">
          {selectedEvidence ? (
            <>
              {/* Clean Light Viewer Toolbar */}
              <div className="px-5 py-3 bg-[#F6F8FC] border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 min-w-0">
                <div className="min-w-0 flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                    {selectedEvidence.evidenceCode}
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="text-sm font-bold text-slate-900 truncate"
                      title={selectedEvidence.originalFilename}
                    >
                      {selectedEvidence.originalFilename}
                    </h2>
                    <div className="text-[11px] text-slate-500 truncate">
                      {selectedEvidence.boundingBoxes?.length || 0} highlighted text regions · Locked (SHA-256)
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowBoundingBoxes((v) => !v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                      showBoundingBoxes
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    <span>
                      Highlight boxes ({selectedEvidence.boundingBoxes?.length || 0})
                    </span>
                  </button>

                  {/* Zoom Controls */}
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
                      className="p-1 hover:text-slate-900 cursor-pointer"
                      title="Zoom out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(100)}
                      className="px-1.5 text-[11px] font-bold text-blue-600 hover:underline cursor-pointer tabular-nums"
                      title="Reset zoom"
                    >
                      {zoomLevel}%
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                      className="p-1 hover:text-slate-900 cursor-pointer"
                      title="Zoom in"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <a
                    href={`/api/v1/evidence/${encodeURIComponent(selectedEvidence.id)}/raw`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition"
                    title="Open original file in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Light #F6F8FC Stage Area */}
              <div className="p-5 sm:p-6 bg-[#F6F8FC] flex items-center justify-center overflow-auto min-w-0">
                <div
                  className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs transition-transform duration-150 ease-out w-full max-w-[640px]"
                  style={{
                    transform: `scale(${zoomLevel / 100})`,
                    transformOrigin: 'center center',
                  }}
                >
                  {!imgLoadError ? (
                    <div className="relative inline-block overflow-hidden rounded-xl bg-[#F6F8FC] border border-slate-200/70 w-full">
                      <img
                        src={`/api/v1/evidence/${encodeURIComponent(
                          selectedEvidence.id
                        )}/raw?v=${(selectedEvidence.sha256Hash || '').slice(0, 8)}`}
                        alt={selectedEvidence.originalFilename}
                        className="block w-full h-auto select-none"
                        onError={() => setImgLoadError(true)}
                      />

                      {/* Clickable & Hover-Synced Highlight Boxes */}
                      {showBoundingBoxes &&
                        selectedEvidence.boundingBoxes &&
                        selectedEvidence.boundingBoxes.map((box, idx) => {
                          const isBoxActive =
                            selectedBoxId === box.id || hoveredBoxId === box.id;
                          const isHighRisk =
                            box.entityType === 'URL' ||
                            box.entityType === 'IP_ADDRESS' ||
                            box.entityType === 'CRYPTO_WALLET';
                          const isFinancial =
                            box.entityType === 'BANK_ACCOUNT' ||
                            box.entityType === 'UPI_ID' ||
                            box.entityType === 'TRANSACTION_ID';

                          const boxStyle = isHighRisk
                            ? isBoxActive
                              ? 'border-[#E24A3B] bg-[#E24A3B]/20 ring-2 ring-[#E24A3B]'
                              : 'border-[#E24A3B]/80 bg-[#E24A3B]/10'
                            : isFinancial
                            ? isBoxActive
                              ? 'border-[#D9822B] bg-[#D9822B]/20 ring-2 ring-[#D9822B]'
                              : 'border-[#D9822B]/80 bg-[#D9822B]/10'
                            : isBoxActive
                            ? 'border-[#2563EB] bg-[#2563EB]/20 ring-2 ring-[#2563EB]'
                            : 'border-[#2563EB]/75 bg-[#2563EB]/10';

                          const tagBg = isHighRisk
                            ? 'bg-[#E24A3B] text-white'
                            : isFinancial
                            ? 'bg-[#D9822B] text-white'
                            : 'bg-[#2563EB] text-white';

                          return (
                            <div
                              key={box.id || idx}
                              onClick={() => {
                                setSelectedBoxId(box.id);
                                setInspectorTab('TEXT');
                              }}
                              onMouseEnter={() => setHoveredBoxId(box.id)}
                              onMouseLeave={() => setHoveredBoxId(null)}
                              title={box.text}
                              style={{
                                left: `${(box.x / 720) * 100}%`,
                                top: `${(box.y / 920) * 100}%`,
                                width: `${(box.width / 720) * 100}%`,
                                height: `${(box.height / 920) * 100}%`,
                              }}
                              className={`absolute border-2 rounded-md cursor-pointer transition-all flex items-start justify-end p-0.5 ${boxStyle}`}
                            >
                              <span
                                className={`px-1.5 py-0.2 text-[9px] font-semibold rounded-xs pointer-events-none ${tagBg}`}
                              >
                                {formatPlainEntityType(box.entityType)}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    /* Clean Light Document Preview with Clickable Highlight Regions & Full Uncut Text */
                    <div className="space-y-3 min-w-0">
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                            Document Preview &amp; Highlighted Regions
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 break-words mt-0.5">
                            {selectedEvidence.originalFilename}
                          </h3>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EEF4FF] text-blue-700 shrink-0">
                          {Math.round((selectedEvidence.ocrConfidence || 0.99) * 100)}% read accuracy
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {selectedEvidence.boundingBoxes &&
                        selectedEvidence.boundingBoxes.length > 0 ? (
                          selectedEvidence.boundingBoxes.map((box, idx) => {
                            const isBoxActive =
                              selectedBoxId === box.id || hoveredBoxId === box.id;
                            const isHighRisk =
                              box.entityType === 'URL' ||
                              box.entityType === 'IP_ADDRESS' ||
                              box.entityType === 'CRYPTO_WALLET';
                            const isFinancial =
                              box.entityType === 'BANK_ACCOUNT' ||
                              box.entityType === 'UPI_ID' ||
                              box.entityType === 'TRANSACTION_ID';

                            return (
                              <div
                                key={box.id || idx}
                                onClick={() => {
                                  setSelectedBoxId(box.id);
                                  setInspectorTab('TEXT');
                                }}
                                onMouseEnter={() => setHoveredBoxId(box.id)}
                                onMouseLeave={() => setHoveredBoxId(null)}
                                className={`p-3 rounded-xl border transition cursor-pointer space-y-1 min-w-0 ${
                                  isBoxActive
                                    ? 'bg-[#EEF4FF] border-blue-400 ring-1 ring-blue-400'
                                    : isHighRisk
                                    ? 'bg-[#FDECEC]/45 border-red-200/80 hover:bg-[#FDECEC]/70'
                                    : isFinancial
                                    ? 'bg-[#FEF3DF]/45 border-amber-200/80 hover:bg-[#FEF3DF]/70'
                                    : 'bg-[#F6F8FC] border-slate-200/80 hover:bg-slate-100/70'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                  <span
                                    className={`px-2 py-0.5 rounded-md font-semibold ${
                                      isHighRisk
                                        ? 'bg-[#FDECEC] text-[#B42318]'
                                        : isFinancial
                                        ? 'bg-[#FEF3DF] text-[#9A5B13]'
                                        : 'bg-[#EEF4FF] text-[#1E40AF]'
                                    }`}
                                  >
                                    {formatPlainEntityType(box.entityType)}
                                  </span>
                                  <span className="text-slate-400 font-mono text-[10px]">
                                    Region #{idx + 1} · {Math.round((box.confidence || 0.99) * 100)}% match
                                  </span>
                                </div>

                                {/* Full uncut text string */}
                                <div className="text-xs font-semibold text-slate-900 whitespace-normal break-words leading-snug select-all">
                                  {box.text}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-6 text-center text-xs text-slate-400">
                            No highlighted text regions in this file.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-16 text-center text-slate-400 text-xs">
              Select an evidence file from the left list to inspect it.
            </div>
          )}
        </section>

        {/* ===================================================================
            COLUMN 3: RIGHT INSPECTOR (3 Tabs: Text found | Fingerprint | History)
            =================================================================== */}
        <aside className="cf-card p-4 space-y-4 min-w-0 self-start lg:sticky lg:top-[calc(var(--shell-h,148px)+16px)]">
          {selectedEvidence ? (
            <>
              {/* 3-Tab Spring Switcher */}
              <DropletTabs
                variant="compact"
                ariaLabel="Evidence details tabs"
                idPrefix="evidence-inspector"
                items={INSPECTOR_TABS}
                value={inspectorTab}
                onChange={(id) => setInspectorTab(id as InspectorTabId)}
                className="w-full justify-between"
              />

              {/* -------------------------------------------------------------
                  TAB 1: TEXT FOUND (Full uncut text rows synced with viewer)
                  ------------------------------------------------------------- */}
              {inspectorTab === 'TEXT' && (
                <div className="space-y-3.5 min-w-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      Extracted text ({selectedEvidence.boundingBoxes?.length || 0} items)
                    </span>
                    {selectedBoxId && (
                      <button
                        type="button"
                        onClick={() => setSelectedBoxId(null)}
                        className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                      >
                        Clear highlight
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 min-w-0">
                    {selectedEvidence.boundingBoxes &&
                    selectedEvidence.boundingBoxes.length > 0 ? (
                      selectedEvidence.boundingBoxes.map((box, idx) => {
                        const isRowHighlighted =
                          selectedBoxId === box.id || hoveredBoxId === box.id;
                        const isHighRisk =
                          box.entityType === 'URL' ||
                          box.entityType === 'IP_ADDRESS' ||
                          box.entityType === 'CRYPTO_WALLET';
                        const isFinancial =
                          box.entityType === 'BANK_ACCOUNT' ||
                          box.entityType === 'UPI_ID' ||
                          box.entityType === 'TRANSACTION_ID';

                        return (
                          <div
                            key={box.id || idx}
                            onClick={() =>
                              setSelectedBoxId((prev) =>
                                prev === box.id ? null : box.id
                              )
                            }
                            onMouseEnter={() => setHoveredBoxId(box.id)}
                            onMouseLeave={() => setHoveredBoxId(null)}
                            className={`p-3 rounded-xl border transition cursor-pointer space-y-1 min-w-0 ${
                              isRowHighlighted
                                ? 'bg-[#EEF4FF] border-blue-400 ring-1 ring-blue-400'
                                : 'bg-[#F6F8FC] hover:bg-slate-100/70 border-slate-200/80'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                  isHighRisk
                                    ? 'bg-[#FDECEC] text-[#B42318]'
                                    : isFinancial
                                    ? 'bg-[#FEF3DF] text-[#9A5B13]'
                                    : 'bg-[#EEF4FF] text-[#1E40AF]'
                                }`}
                              >
                                {formatPlainEntityType(box.entityType)}
                              </span>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyText(box.text, `TEXT_${idx}`);
                                }}
                                className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                title="Copy text"
                              >
                                {copiedField === `TEXT_${idx}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            {/* Full text — never cut off */}
                            <div className="text-xs font-medium text-slate-900 whitespace-normal break-words leading-snug select-all">
                              {box.text}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No extracted text rows for this file.
                      </div>
                    )}
                  </div>

                  {/* Full plain-text transcript */}
                  {selectedEvidence.ocrRawText && (
                    <div className="pt-2 border-t border-slate-100 space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-600">
                          Full text transcript
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              selectedEvidence.ocrRawText || '',
                              'RAW_TRANSCRIPT'
                            )
                          }
                          className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          {copiedField === 'RAW_TRANSCRIPT' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="p-3 rounded-xl bg-[#F6F8FC] border border-slate-200/80 font-mono text-[11px] text-slate-800 whitespace-normal break-words leading-snug select-all">
                        {selectedEvidence.ocrRawText}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* -------------------------------------------------------------
                  TAB 2: FINGERPRINT (Status + Short Hash + Verify Again + Photo Details + Tamper Test)
                  ------------------------------------------------------------- */}
              {inspectorTab === 'FINGERPRINT' && (
                <div className="space-y-4 min-w-0">
                  {/* 1. Big Status Banner */}
                  {(() => {
                    const isIntact =
                      selectedEvidence.integrityStatus === 'VERIFIED_INTACT';
                    return (
                      <div
                        className={`p-4 rounded-2xl border flex items-center gap-3 min-w-0 ${
                          isIntact
                            ? 'bg-[#E7F6EF] border-emerald-200 text-[#0E6B45]'
                            : 'bg-[#FDECEC] border-red-200 text-[#B42318]'
                        }`}
                      >
                        {isIntact ? (
                          <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shrink-0">
                            {showVerifiedCheckDraw ? (
                              <svg
                                viewBox="0 0 24 24"
                                className="w-5 h-5 text-[#129960]"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.6}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path
                                  d="M20 6L9 17l-5-5"
                                  className="cf-check-stroke"
                                />
                              </svg>
                            ) : (
                              <CheckCircle2 className="w-5 h-5 text-[#129960]" />
                            )}
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shrink-0">
                            <ShieldAlert className="w-5 h-5 text-[#E24A3B]" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="text-sm font-bold leading-snug">
                            {isIntact
                              ? 'Unchanged since upload ✓'
                              : 'Changed ✗'}
                          </div>
                          <div className="text-xs opacity-90 mt-0.5">
                            {isIntact
                              ? 'Digital fingerprint matches the original file.'
                              : 'This file no longer matches its original fingerprint.'}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 2. Digital Fingerprint (Short by default with "Show full") */}
                  <div className="p-3.5 rounded-xl bg-[#F6F8FC] border border-slate-200/80 space-y-2 min-w-0">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-700">
                        Digital fingerprint (SHA-256)
                      </span>
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setShowFullFingerprint((v) => !v)}
                          className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                        >
                          {showFullFingerprint ? 'Show short' : 'Show full'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              selectedEvidence.sha256Hash || '',
                              'SHA_MAIN'
                            )
                          }
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                          title="Copy full fingerprint"
                        >
                          {copiedField === 'SHA_MAIN' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 font-mono text-xs text-slate-900 break-all select-all">
                      {scrambledHash !== null
                        ? scrambledHash
                        : showFullFingerprint
                        ? selectedEvidence.sha256Hash
                        : `${(selectedEvidence.sha256Hash || '').slice(0, 12)}…${(
                            selectedEvidence.sha256Hash || ''
                          ).slice(-6)}`}
                    </div>

                    {/* Verify again button */}
                    <button
                      type="button"
                      onClick={handleVerifyAgain}
                      disabled={isVerifyingAgain}
                      className="cf-btn-blue w-full h-9 text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          isVerifyingAgain ? 'animate-spin' : ''
                        }`}
                      />
                      <span>
                        {isVerifyingAgain ? 'Checking fingerprint…' : 'Verify again'}
                      </span>
                    </button>
                  </div>

                  {/* 3. Photo details (inside Fingerprint tab with plain warning badge if edited) */}
                  <div className="p-3.5 rounded-xl bg-[#F6F8FC] border border-slate-200/80 space-y-2.5 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700">
                        Photo details
                      </span>
                      {selectedEvidence.timestampAnomaly ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF3DF] text-[#9A5B13]">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Photo was edited</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E7F6EF] text-[#0E6B45]">
                          Original camera file
                        </span>
                      )}
                    </div>

                    {selectedEvidence.timestampAnomaly && (
                      <div className="p-2.5 rounded-lg bg-[#FEF3DF] border border-amber-200/80 text-xs text-[#9A5B13] leading-snug">
                        {selectedEvidence.timestampAnomalyDetail ||
                          'The photo timestamp was changed 14 minutes after the bank transfer occurred.'}
                      </div>
                    )}

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between gap-2 py-1 border-b border-slate-200/60">
                        <span className="text-slate-500">Uploaded</span>
                        <span className="font-mono text-slate-800 text-[11px]">
                          {selectedEvidence.uploadedAt?.slice(0, 19).replace('T', ' ') ||
                            '2026-10-01 10:45:00'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 py-1 border-b border-slate-200/60">
                        <span className="text-slate-500">File size</span>
                        <span className="font-mono text-slate-800 text-[11px]">
                          {formatBytes(selectedEvidence.fileSizeBytes || 184500)}
                        </span>
                      </div>
                      {selectedEvidence.exifMetadata &&
                        Object.entries(selectedEvidence.exifMetadata)
                          .slice(0, 4)
                          .map(([k, v]) => (
                            <div
                              key={k}
                              className="flex justify-between gap-2 py-1 border-b border-slate-200/60 last:border-b-0"
                            >
                              <span className="text-slate-500">{k}</span>
                              <span className="font-mono text-slate-800 text-[11px] text-right break-all">
                                {v}
                              </span>
                            </div>
                          ))}
                    </div>
                  </div>

                  {/* 4. Compact Tamper Test Section */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500">
                      Test tamper detection:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onSimulateTamper(
                          selectedEvidence.id,
                          selectedEvidence.integrityStatus !== 'TAMPER_DETECTED'
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Flame className="w-3.5 h-3.5 text-amber-600" />
                      <span>
                        {selectedEvidence.integrityStatus === 'TAMPER_DETECTED'
                          ? 'Restore original file'
                          : 'Simulate tamper'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  TAB 3: HISTORY (Plain-English custody log)
                  ------------------------------------------------------------- */}
              {inspectorTab === 'HISTORY' && (
                <div className="space-y-3 min-w-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      File activity history
                    </span>
                    <span className="text-slate-400">
                      {artifactCustodyLedger.length} events
                    </span>
                  </div>

                  <div className="space-y-2 min-w-0">
                    {artifactCustodyLedger.length > 0 ? (
                      artifactCustodyLedger.map((entry, idx) => (
                        <div
                          key={entry.id || idx}
                          className="p-3 rounded-xl bg-[#F6F8FC] border border-slate-200/80 text-xs space-y-1 min-w-0"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-semibold text-blue-700">
                              {entry.actionType.replace(/_/g, ' ')}
                            </span>
                            <span className="font-mono text-slate-400">
                              {entry.timestamp?.slice(11, 19) || '10:00:00'} UTC
                            </span>
                          </div>
                          <div className="text-xs text-slate-800 whitespace-normal break-words leading-snug">
                            {entry.details}
                          </div>
                          <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between">
                            <span>By: {entry.actorUsername || 'investigator'}</span>
                            <span className="font-mono">
                              #{entry.sequenceNumber || idx + 1}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No history entries recorded for this file.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              Select a file to view its extracted text, fingerprint, and history.
            </div>
          )}
        </aside>
      </div>

      {/* ── Add Evidence Modal ──────────────────────────────────────────────── */}
      {showIngestDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="cf-card max-w-xl w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Add Evidence File
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIngestDrawer(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Upload File */}
              <div className="p-4 rounded-xl bg-[#F6F8FC] border border-slate-200/80 space-y-3">
                <div className="font-bold text-slate-900">Upload from computer</div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    File type
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full p-2 rounded-lg bg-white border border-slate-200 text-slate-800"
                  >
                    <option value="SMS_SCREENSHOT">Screenshot / Message</option>
                    <option value="TRANSACTION_RECEIPT">Bank / Payment Receipt</option>
                    <option value="EMAIL_HEADER">Email / Login Log</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    className="w-full p-2 rounded-lg bg-white border border-slate-200 text-slate-800"
                  />
                </div>
                <label className="cf-btn-blue w-full h-9 inline-flex items-center justify-center gap-2 cursor-pointer font-semibold">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{busyAction ? 'Uploading…' : 'Choose file'}</span>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    disabled={busyAction}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Quick Sample Text */}
              <form
                onSubmit={handleQuickIngestSubmit}
                className="p-4 rounded-xl bg-[#F6F8FC] border border-slate-200/80 space-y-2.5"
              >
                <div className="font-bold text-slate-900">Add text transcript</div>
                <div className="flex gap-1.5">
                  {PRESET_TEMPLATES.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setQuickTitle(tpl.title);
                        setQuickCategory(tpl.category);
                        setQuickContent(tpl.content);
                      }}
                      className="px-2 py-1 rounded bg-white border border-slate-200 text-[10px] font-semibold text-blue-600 hover:bg-blue-50 cursor-pointer"
                    >
                      Sample {i + 1}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full p-2 rounded-lg bg-white border border-slate-200 text-slate-800"
                />
                <textarea
                  rows={3}
                  value={quickContent}
                  onChange={(e) => setQuickContent(e.target.value)}
                  placeholder="Paste text content..."
                  className="w-full p-2 rounded-lg bg-white border border-slate-200 text-slate-800 font-mono text-[11px]"
                />
                <button
                  type="submit"
                  disabled={busyAction}
                  className="w-full h-9 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 font-semibold text-slate-800 cursor-pointer"
                >
                  {busyAction ? 'Adding…' : 'Save text evidence'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
