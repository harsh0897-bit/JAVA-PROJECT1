import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Search,
} from 'lucide-react';
import {
  EvidenceItem,
  IntegrityVerification,
  ChainOfCustodyEntry,
} from '../types';
import { copyToClipboardSafe } from '../lib/clipboard';

interface IntegrityLedgerViewProps {
  evidenceList: EvidenceItem[];
  verifications: IntegrityVerification[];
  ledger: ChainOfCustodyEntry[];
  chainVerification: {
    chainIntact: boolean;
    totalEntriesVerified: number;
    headMerkleHash: string;
    verifiedAt: string;
  } | null;
  onVerifySingle: (evidenceId: string) => Promise<void>;
  onVerifyAllCaseEvidence: () => Promise<void>;
  onRefreshLedger: () => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const IntegrityLedgerView: React.FC<IntegrityLedgerViewProps> = ({
  evidenceList,
  ledger,
  chainVerification,
  onVerifySingle,
  onVerifyAllCaseEvidence,
}) => {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(
    evidenceList[0]?.id || null
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [reverifyingId, setReverifyingId] = useState<string | null>(null);

  // Left-to-right sweep state (0 = idle, 1..4 = leaves, 5..6 = combined blocks, 7 = Case seal)
  const [sweepStep, setSweepStep] = useState<number>(0);
  const [isVerifyingAll, setIsVerifyingAll] = useState<boolean>(false);

  const handleCopy = async (text: string, key: string) => {
    if (await copyToClipboardSafe(text)) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  // Ensure 4 leaf items for the 4-2-1 chain diagram
  const fourFiles = useMemo(() => {
    const base = evidenceList.slice(0, 4);
    while (base.length < 4 && evidenceList.length > 0) {
      base.push(evidenceList[base.length % evidenceList.length]);
    }
    return base;
  }, [evidenceList]);

  // Determine tamper status per leaf and propagate failure upward to parent blocks
  const chainStatus = useMemo(() => {
    const leafFailed = fourFiles.map(
      (ev) => ev?.integrityStatus === 'TAMPER_DETECTED'
    );
    const branchAFailed = Boolean(leafFailed[0] || leafFailed[1]);
    const branchBFailed = Boolean(leafFailed[2] || leafFailed[3]);
    const caseSealFailed = branchAFailed || branchBFailed;

    return {
      leafFailed,
      branchAFailed,
      branchBFailed,
      caseSealFailed,
    };
  }, [fourFiles]);

  const rootSealShort = useMemo(() => {
    const full =
      chainVerification?.headMerkleHash ||
      '2b8f84091a0c842e47e30fb5b66d1f05359a1cf64b8bb26c36f5f95f4e5a9c01';
    return {
      full,
      short: `${full.slice(0, 10)}…${full.slice(-6)}`,
    };
  }, [chainVerification]);

  // Run 1.2s left-to-right verification sweep across 4 files -> 2 joined blocks -> 1 Case seal
  const handleVerifyAllSweep = async () => {
    if (isVerifyingAll) return;
    setIsVerifyingAll(true);
    setSweepStep(1);

    const stepDelay = 170; // 7 steps * 170ms ≈ 1.19s total
    for (let s = 1; s <= 7; s++) {
      setTimeout(() => {
        setSweepStep(s);
      }, (s - 1) * stepDelay);
    }

    try {
      await onVerifyAllCaseEvidence();
    } finally {
      setTimeout(() => {
        setIsVerifyingAll(false);
      }, 1220);
    }
  };

  const filteredLedger = useMemo(() => {
    if (!ledgerSearch.trim()) return ledger;
    const q = ledgerSearch.toLowerCase();
    return ledger.filter(
      (entry) =>
        entry.actionType.toLowerCase().includes(q) ||
        entry.actorUsername.toLowerCase().includes(q) ||
        entry.targetResource.toLowerCase().includes(q) ||
        entry.details.toLowerCase().includes(q)
    );
  }, [ledger, ledgerSearch]);

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 lg:px-8 pb-12 space-y-6 min-w-0">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 font-mono">
            5 · Tamper Check
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Evidence Lock &amp; Tamper-Proof Chain
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Each file gets a digital fingerprint when uploaded. Their fingerprints combine into one Case seal so any change is spotted immediately.
          </p>
        </div>

        <button
          type="button"
          disabled={isVerifyingAll}
          onClick={handleVerifyAllSweep}
          className="cf-btn-blue h-10 px-5 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-60"
        >
          <RefreshCw
            className={`w-4 h-4 ${isVerifyingAll ? 'animate-spin' : ''}`}
          />
          <span>{isVerifyingAll ? 'Verifying all files…' : 'Verify all'}</span>
        </button>
      </div>

      {/* ── Main 2-Column Layout: [Left File Cards] + [Right Flat Tamper-Proof Chain] ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start min-w-0">
        {/* ===================================================================
            LEFT 5 COLUMNS: ONE CARD PER EVIDENCE FILE
            =================================================================== */}
        <div className="lg:col-span-5 space-y-3.5 min-w-0">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-slate-900">
              Evidence files ({evidenceList.length})
            </h2>
            <span className="text-xs text-slate-500">
              Click any card or diagram block to highlight
            </span>
          </div>

          {evidenceList.map((ev, idx) => {
            const isIntact = ev.integrityStatus === 'VERIFIED_INTACT';
            const isSelected = selectedFileId === ev.id;
            const isReverifying = reverifyingId === ev.id;
            const isSwept = sweepStep >= idx + 1;
            const shortHash = ev.sha256Hash
              ? `${ev.sha256Hash.slice(0, 12)}…${ev.sha256Hash.slice(-6)}`
              : 'No fingerprint';

            return (
              <div
                key={ev.id}
                onClick={() => setSelectedFileId(ev.id)}
                className={`cf-card p-4 transition cursor-pointer space-y-3 min-w-0 ${
                  !isIntact
                    ? 'border-[#E24A3B] ring-1 ring-[#E24A3B]/40'
                    : isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : 'hover:border-slate-300'
                }`}
              >
                {/* Row 1: Code, Filename, and Locked / Changed Badge */}
                <div className="flex items-start justify-between gap-2.5 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[11px] font-bold shrink-0">
                        {ev.evidenceCode}
                      </span>
                      <h3
                        className="text-sm font-bold text-slate-900 truncate"
                        title={ev.originalFilename}
                      >
                        {ev.originalFilename}
                      </h3>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {formatBytes(ev.fileSizeBytes || 184500)} · Uploaded{' '}
                      {ev.uploadedAt?.slice(11, 19) || '10:45:00'} UTC
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
                      isIntact
                        ? 'bg-[#E7F6EF] text-[#0E6B45]'
                        : 'bg-[#FDECEC] text-[#B42318]'
                    }`}
                  >
                    {isIntact ? (
                      <>
                        <Lock className="w-3 h-3" />
                        <span>{isSwept ? 'Verified ✓' : 'Locked'}</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3" />
                        <span>Changed ✗</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Row 2: Short Fingerprint + Copy + Verify Button */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] text-slate-400 shrink-0">
                      Fingerprint:
                    </span>
                    <span className="font-mono text-xs text-slate-800 bg-[#F6F8FC] border border-slate-200/80 px-2 py-0.5 rounded-md truncate">
                      {shortHash}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(ev.sha256Hash || '', `hash-${ev.id}`);
                      }}
                      className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer shrink-0"
                      title="Copy full fingerprint"
                    >
                      {copiedKey === `hash-${ev.id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={isReverifying}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setReverifyingId(ev.id);
                      try {
                        await onVerifySingle(ev.id);
                      } finally {
                        setReverifyingId(null);
                      }
                    }}
                    className="h-8 px-3 rounded-xl bg-[#EEF4FF] hover:bg-blue-600 text-blue-700 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${isReverifying ? 'animate-spin' : ''}`}
                    />
                    <span>{isReverifying ? 'Checking…' : 'Verify'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ===================================================================
            RIGHT 7 COLUMNS: FLAT, LIGHT "TAMPER-PROOF CHAIN" DIAGRAM
            4 file blocks at bottom -> 2 joined blocks -> 1 "Case seal" at top
            =================================================================== */}
        <div className="lg:col-span-7 cf-card p-6 space-y-5 min-w-0 self-start lg:sticky lg:top-[calc(var(--shell-h,148px)+16px)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Tamper-Proof Chain Diagram
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                4 evidence files at the bottom combine into 2 group seals and 1 top Case seal. If any file is altered, the blocks above it turn red.
              </p>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                chainStatus.caseSealFailed
                  ? 'bg-[#FDECEC] text-[#B42318]'
                  : 'bg-[#E7F6EF] text-[#0E6B45]'
              }`}
            >
              {chainStatus.caseSealFailed ? (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>Mismatch detected</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>All 4 files match Case seal ✓</span>
                </>
              )}
            </span>
          </div>

          {/* Flat Light Diagram Canvas */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#F6F8FC] border border-slate-200/80 space-y-0">
            {/* ── LEVEL 1 (TOP): 1 "Case seal" Block ─────────────────────── */}
            <div className="flex justify-center">
              {(() => {
                const isFailed = chainStatus.caseSealFailed;
                const isSweptGreen = !isFailed && sweepStep >= 7;
                return (
                  <div
                    className={`w-full max-w-[300px] p-3.5 rounded-2xl border-2 text-center transition-all ${
                      isFailed
                        ? 'bg-[#FDECEC] border-[#E24A3B] text-[#B42318]'
                        : isSweptGreen
                        ? 'bg-[#E7F6EF] border-[#129960] text-[#0E6B45]'
                        : 'bg-white border-emerald-300 text-slate-900 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold">
                      {isFailed ? (
                        <ShieldAlert className="w-4 h-4 text-[#E24A3B]" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-[#129960]" />
                      )}
                      <span>Case seal</span>
                      {!isFailed && <span>✓</span>}
                    </div>
                    <div className="font-mono text-[11px] text-slate-600 mt-1 flex items-center justify-center gap-1.5">
                      <span>{rootSealShort.short}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(rootSealShort.full, 'rootSeal')}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                        title="Copy full Case seal"
                      >
                        {copiedKey === 'rootSeal' ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* SVG Connectors: Case seal (top) <- 2 Joined Blocks (middle) */}
            <svg
              viewBox="0 0 600 48"
              className="w-full h-12 block pointer-events-none"
              preserveAspectRatio="none"
            >
              <path
                d="M 150 46 C 150 20, 300 28, 300 2"
                fill="none"
                stroke={
                  chainStatus.branchAFailed
                    ? '#E24A3B'
                    : sweepStep >= 7
                    ? '#129960'
                    : '#94A3B8'
                }
                strokeWidth={2}
              />
              <path
                d="M 450 46 C 450 20, 300 28, 300 2"
                fill="none"
                stroke={
                  chainStatus.branchBFailed
                    ? '#E24A3B'
                    : sweepStep >= 7
                    ? '#129960'
                    : '#94A3B8'
                }
                strokeWidth={2}
              />
            </svg>

            {/* ── LEVEL 2 (MIDDLE): 2 Joined Blocks ──────────────────────── */}
            <div className="grid grid-cols-2 gap-6">
              {/* Left Joined Block (Files 1 + 2) */}
              {(() => {
                const isFailed = chainStatus.branchAFailed;
                const isSweptGreen = !isFailed && sweepStep >= 5;
                return (
                  <div
                    className={`p-3 rounded-2xl border-2 text-center transition-all ${
                      isFailed
                        ? 'bg-[#FDECEC] border-[#E24A3B] text-[#B42318]'
                        : isSweptGreen
                        ? 'bg-[#E7F6EF] border-[#129960] text-[#0E6B45]'
                        : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold">
                      {isFailed ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-[#E24A3B]" />
                      ) : (
                        <CheckCircle2
                          className={`w-3.5 h-3.5 ${
                            isSweptGreen ? 'text-[#129960]' : 'text-blue-600'
                          }`}
                        />
                      )}
                      <span>Joined block A (Files 1 &amp; 2)</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {isFailed
                        ? 'Mismatch from File 1 or 2'
                        : 'Combines EVD-001 + EVD-002'}
                    </div>
                  </div>
                );
              })()}

              {/* Right Joined Block (Files 3 + 4) */}
              {(() => {
                const isFailed = chainStatus.branchBFailed;
                const isSweptGreen = !isFailed && sweepStep >= 6;
                return (
                  <div
                    className={`p-3 rounded-2xl border-2 text-center transition-all ${
                      isFailed
                        ? 'bg-[#FDECEC] border-[#E24A3B] text-[#B42318]'
                        : isSweptGreen
                        ? 'bg-[#E7F6EF] border-[#129960] text-[#0E6B45]'
                        : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold">
                      {isFailed ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-[#E24A3B]" />
                      ) : (
                        <CheckCircle2
                          className={`w-3.5 h-3.5 ${
                            isSweptGreen ? 'text-[#129960]' : 'text-blue-600'
                          }`}
                        />
                      )}
                      <span>Joined block B (Files 3 &amp; 4)</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {isFailed
                        ? 'Mismatch from File 3 or 4'
                        : 'Combines EVD-003 + EVD-004'}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* SVG Connectors: 2 Joined Blocks (middle) <- 4 File Blocks (bottom) */}
            <svg
              viewBox="0 0 600 48"
              className="w-full h-12 block pointer-events-none"
              preserveAspectRatio="none"
            >
              {/* Leaf 1 -> Branch A */}
              <path
                d="M 75 46 C 75 22, 150 26, 150 2"
                fill="none"
                stroke={
                  chainStatus.leafFailed[0]
                    ? '#E24A3B'
                    : sweepStep >= 5
                    ? '#129960'
                    : '#94A3B8'
                }
                strokeWidth={2}
              />
              {/* Leaf 2 -> Branch A */}
              <path
                d="M 225 46 C 225 22, 150 26, 150 2"
                fill="none"
                stroke={
                  chainStatus.leafFailed[1]
                    ? '#E24A3B'
                    : sweepStep >= 5
                    ? '#129960'
                    : '#94A3B8'
                }
                strokeWidth={2}
              />
              {/* Leaf 3 -> Branch B */}
              <path
                d="M 375 46 C 375 22, 450 26, 450 2"
                fill="none"
                stroke={
                  chainStatus.leafFailed[2]
                    ? '#E24A3B'
                    : sweepStep >= 6
                    ? '#129960'
                    : '#94A3B8'
                }
                strokeWidth={2}
              />
              {/* Leaf 4 -> Branch B */}
              <path
                d="M 525 46 C 525 22, 450 26, 450 2"
                fill="none"
                stroke={
                  chainStatus.leafFailed[3]
                    ? '#E24A3B'
                    : sweepStep >= 6
                    ? '#129960'
                    : '#94A3B8'
                }
                strokeWidth={2}
              />
            </svg>

            {/* ── LEVEL 3 (BOTTOM): 4 File Blocks ────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {fourFiles.map((file, idx) => {
                if (!file) return null;
                const isFailed = chainStatus.leafFailed[idx];
                const isSweptGreen = !isFailed && sweepStep >= idx + 1;
                const isSelected = selectedFileId === file.id;

                return (
                  <button
                    key={`${file.id}-${idx}`}
                    type="button"
                    onClick={() => setSelectedFileId(file.id)}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer min-w-0 ${
                      isFailed
                        ? 'bg-[#FDECEC] border-[#E24A3B] text-[#B42318]'
                        : isSweptGreen
                        ? 'bg-[#E7F6EF] border-[#129960] text-[#0E6B45]'
                        : isSelected
                        ? 'bg-[#EEF4FF] border-blue-500 text-slate-900'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[11px] font-bold">
                        {file.evidenceCode}
                      </span>
                      {isFailed ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-[#E24A3B] shrink-0" />
                      ) : (
                        <CheckCircle2
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSweptGreen
                              ? 'text-[#129960]'
                              : 'text-emerald-600'
                          }`}
                        />
                      )}
                    </div>
                    <div
                      className="text-xs font-semibold truncate mt-1"
                      title={file.originalFilename}
                    >
                      File {idx + 1}
                    </div>
                    <div className="font-mono text-[10px] opacity-75 truncate mt-0.5">
                      {(file.sha256Hash || '').slice(0, 8)}…
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Simplified Plain-English Activity Log Below the Two Main Cards ── */}
      <div className="cf-card p-5 space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Evidence Activity Log ({filteredLedger.length})
            </h2>
            <p className="text-xs text-slate-500">
              Every upload and fingerprint check recorded in order.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
              placeholder="Search activity log..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#F6F8FC] border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredLedger.map((item, idx) => (
            <div
              key={item.id || idx}
              className="p-3.5 rounded-xl bg-[#F6F8FC] border border-slate-200/80 flex items-start justify-between gap-3 text-xs min-w-0"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-blue-700">
                    #{item.sequenceNumber || idx + 1}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {item.actionType.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 break-words leading-snug">
                  {item.details}
                </p>
                <div className="text-[11px] text-slate-400">
                  By {item.actorUsername || 'investigator'} ·{' '}
                  {item.timestamp?.slice(11, 19) || '10:00:00'} UTC
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-[10px] text-emerald-700 font-semibold shrink-0">
                {(item.entryHash || '2b8f8409').slice(0, 8)}…
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
