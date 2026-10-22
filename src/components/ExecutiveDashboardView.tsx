import React, { useMemo } from 'react';
import {
  ArrowRight,
  FolderLock,
  Network,
  FileText,
  Lock,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Coins,
  CheckCircle2,
} from 'lucide-react';
import {
  ForensicCaseSummary,
  EvidenceItem,
  ExtractedEntity,
  EntityRelationship,
  TimelineEvent,
  UserProfile,
} from '../types';
import { ThreatGlobe } from './3d/ThreatGlobe';

interface ExecutiveDashboardViewProps {
  currentUser: UserProfile | null;
  activeCase: ForensicCaseSummary;
  evidenceList: EvidenceItem[];
  entities: ExtractedEntity[];
  relationships: EntityRelationship[];
  timeline: TimelineEvent[];
  onNavigateTab: (
    tab: 'OVERVIEW' | 'EVIDENCE' | 'TIMELINE' | 'GRAPH' | 'INTEGRITY' | 'REPORT'
  ) => void;
  onSelectEntityForGraph: (entityId: string) => void;
  onSelectEvidenceForVault: (evidenceId: string) => void;
  onEditCase?: () => void;
}

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  activeCase,
  evidenceList,
  entities,
  relationships,
  timeline,
  onNavigateTab,
  onSelectEvidenceForVault,
  onEditCase,
}) => {
  const isUserCreated =
    activeCase.caseOrigin === 'USER_CREATED' ||
    activeCase.id.startsWith('case-custom-');

  const displayEvidence = useMemo(() => {
    return evidenceList.slice(0, 4);
  }, [evidenceList]);

  const riskScore = isUserCreated
    ? activeCase.riskScore ?? 0
    : activeCase.riskScore || 81;
  const anomalyCount = isUserCreated
    ? activeCase.metadataAnomalyCount ?? 0
    : activeCase.metadataAnomalyCount || 1;

  const formattedLoss = useMemo(() => {
    const txs = activeCase.transactions || [];
    if (txs.length > 0) {
      const byCurr = new Map<string, number>();
      const seenRef = new Set<string>();
      for (const tx of txs) {
        const ref = (tx.referenceId || '').trim();
        if (ref) {
          const k = `${tx.currency}:${ref.toLowerCase()}`;
          if (seenRef.has(k)) continue;
          seenRef.add(k);
        }
        const curr = (tx.currency || 'USD').toUpperCase();
        const minor =
          typeof tx.amountMinor === 'number' && Number.isFinite(tx.amountMinor)
            ? tx.amountMinor
            : Math.round((Number(tx.amountDisplay) || 0) * 100);
        byCurr.set(curr, (byCurr.get(curr) || 0) + minor);
      }
      if (byCurr.size > 0) {
        return Array.from(byCurr.entries())
          .map(([curr, minor]) => {
            const major = minor / 100;
            try {
              return major.toLocaleString('en-US', {
                style: 'currency',
                currency: curr,
                maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
              });
            } catch {
              return `${curr} ${major.toFixed(2)}`;
            }
          })
          .join(' · ');
      }
    }
    if (isUserCreated) {
      if (
        typeof activeCase.estimatedLossUsd === 'number' &&
        activeCase.estimatedLossUsd > 0
      ) {
        return activeCase.estimatedLossUsd.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        });
      }
      return 'Not recorded';
    }
    return (activeCase.estimatedLossUsd || 18450).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
  }, [activeCase.transactions, activeCase.estimatedLossUsd, isUserCreated]);

  // Four-step "What happened" case narrative derived from case timeline events
  const narrativeSteps = useMemo(() => {
    if (isUserCreated) {
      return [...(timeline || [])]
        .sort((a, b) => {
          if (!a.eventTimestamp && !b.eventTimestamp) return 0;
          if (!a.eventTimestamp) return 1;
          if (!b.eventTimestamp) return -1;
          return (
            new Date(a.eventTimestamp).getTime() -
            new Date(b.eventTimestamp).getTime()
          );
        })
        .slice(0, 4);
    }
    if (timeline && timeline.length >= 4) {
      return timeline.slice(0, 4);
    }
    // Fallback four steps for pre-loaded cases only
    return [
      {
        id: 'step-1',
        title: 'Spear-Phishing SMS Lure & Credential Ingress',
        description:
          'Victim received an urgent fake KYC text message routing them to an impersonation reverse-proxy domain.',
        eventTimestamp: '2026-10-01T10:12:18Z',
        killChainPhase: 'INGRESS & LURE',
        anomalyFlag: false,
      },
      {
        id: 'step-2',
        title: 'Session Token & One-Time Code Interception',
        description:
          'Harvested corporate session tokens and multi-factor approval allowed unauthorized API access.',
        eventTimestamp: '2026-10-01T10:21:40Z',
        killChainPhase: 'HARVESTING',
        anomalyFlag: false,
      },
      {
        id: 'step-3',
        title: 'Multi-Hop Transfer Through Intermediary Mules',
        description:
          'Funds rapidly divided into Level-1 and Level-2 pass-through accounts to evade real-time bank AML thresholds.',
        eventTimestamp: '2026-10-01T10:28:44Z',
        killChainPhase: 'LAYERING',
        anomalyFlag: true,
        anomalyReason: 'Photo EXIF timestamp discrepancy detected',
      },
      {
        id: 'step-4',
        title: 'Offshore Conversion & Digital Currency Settlement',
        description:
          'Stolen balance pooled into an external Tron USDT wallet address, severing domestic recovery avenues.',
        eventTimestamp: '2026-10-01T10:35:12Z',
        killChainPhase: 'CASHOUT',
        anomalyFlag: false,
      },
    ];
  }, [timeline, isUserCreated]);

  return (
    <div className="mx-auto w-full max-w-[1680px] pb-12 space-y-5 min-w-0 font-sans">
      {/* ════════════════════════════════════════════════════════════════════════
          ROW 1: SLIM CASE HEADER (Target max height ~64-72px on desktop)
      ════════════════════════════════════════════════════════════════════════ */}
      <section className="cf-card px-5 py-3.5 min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 min-w-0">
            {/* Status & Severity Chips */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-[#0F1B33] border border-[#E2E8F1]">
                {activeCase.caseNumber}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#059669] border border-emerald-200">
                Active case
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-[#DC2626] border border-red-200">
                {activeCase.severity === 'CRITICAL' ? 'Critical priority' : 'High priority'}
              </span>
            </div>

            <div className="h-4 w-px bg-slate-200 hidden sm:block shrink-0" />

            {/* Case Title */}
            <h1 className="text-base sm:text-lg font-bold text-[#0F1B33] tracking-tight truncate max-w-2xl">
              {activeCase.title}
            </h1>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {onEditCase && (
              <button
                type="button"
                onClick={onEditCase}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F1] text-[#0F1B33] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>Edit case</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab('EVIDENCE')}
              className="px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>Open evidence</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('REPORT')}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F1] text-[#0F1B33] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#5B6B85]" />
              <span>Export report</span>
            </button>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          ROW 2: [LEFT 8 COLS: 3D THREAT GLOBE | RIGHT 4 COLS: 2x2 GRID + EVIDENCE + CTA]
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start min-w-0">
        {/* Left 8 Columns: Responsive 3D Threat Globe Card */}
        <div className="lg:col-span-8 min-w-0">
          <ThreatGlobe
            activeCase={activeCase}
            entities={entities}
            relationships={relationships}
            onInspectGraph={() => onNavigateTab('GRAPH')}
            style={{
              height: 'clamp(524px, calc(100dvh - var(--shell-h, 148px) - 86px), 820px)',
            }}
          />
        </div>

        {/* Right 4 Columns: 2x2 Key Value Grid + Evidence Files + Graph Action */}
        <div className="lg:col-span-4 flex flex-col gap-4 min-w-0 self-start">
          {/* 1. Compact 2x2 Grid of Existing Real Values */}
          <div className="grid grid-cols-2 gap-3 min-w-0">
            {/* Risk Level */}
            <button
              type="button"
              onClick={() => onNavigateTab('INTEGRITY')}
              className="cf-card cf-card-hover p-3.5 text-left flex flex-col justify-between min-w-0 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5B6B85]">
                  Risk level
                </span>
                <span className="w-2 h-2 rounded-full bg-[#DC2626] shrink-0" />
              </div>
              <div className="mt-1 text-xl font-bold text-[#0F1B33] tabular-nums tracking-tight">
                {riskScore}/100
              </div>
              <div className="mt-1 text-[11px] text-[#DC2626] font-medium truncate">
                {riskScore >= 70 ? 'Immediate review' : `${entities.length} ${entities.length === 1 ? 'entity' : 'entities'} tracked`}
              </div>
            </button>

            {/* Exposure / Money Lost */}
            <button
              type="button"
              onClick={() => onNavigateTab('REPORT')}
              className="cf-card cf-card-hover p-3.5 text-left flex flex-col justify-between min-w-0 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5B6B85]">
                  Exposure
                </span>
                <Coins className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
              </div>
              <div className="mt-1 text-base sm:text-lg font-bold text-[#0F1B33] tabular-nums tracking-tight truncate" title={formattedLoss}>
                {formattedLoss}
              </div>
              <div className="mt-1 text-[11px] text-[#5B6B85] truncate">
                {activeCase.victimName?.split(' ')[0] || 'Recorded'} exposure
              </div>
            </button>

            {/* Evidence Count */}
            <button
              type="button"
              onClick={() => onNavigateTab('EVIDENCE')}
              className="cf-card cf-card-hover p-3.5 text-left flex flex-col justify-between min-w-0 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5B6B85]">
                  Evidence
                </span>
                <span className="w-2 h-2 rounded-full bg-[#059669] shrink-0" />
              </div>
              <div className="mt-1 text-xl font-bold text-[#0F1B33] tabular-nums tracking-tight">
                {isUserCreated ? evidenceList.length : evidenceList.length || 4}{' '}
                {(isUserCreated ? evidenceList.length : evidenceList.length || 4) === 1
                  ? 'file'
                  : 'files'}
              </div>
              <div className="mt-1 text-[11px] text-[#059669] font-medium truncate">
                {evidenceList.length > 0 ? 'WORM sealed' : 'No files recorded'}
              </div>
            </button>

            {/* Warnings / Metadata Anomalies */}
            <button
              type="button"
              onClick={() => onNavigateTab('TIMELINE')}
              className="cf-card cf-card-hover p-3.5 text-left flex flex-col justify-between min-w-0 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5B6B85]">
                  Warnings
                </span>
                <span className="w-2 h-2 rounded-full bg-[#D97706] shrink-0" />
              </div>
              <div className="mt-1 text-xl font-bold text-[#0F1B33] tabular-nums tracking-tight">
                {anomalyCount} {anomalyCount === 1 ? 'anomaly' : 'anomalies'}
              </div>
              <div className="mt-1 text-[11px] text-[#D97706] font-medium truncate">
                {isUserCreated
                  ? anomalyCount > 0
                    ? 'Flagged in case'
                    : 'No warnings flagged'
                  : 'EXIF timestomp'}
              </div>
            </button>
          </div>

          {/* 2. Compact Evidence Files List (Up to 4 rows) */}
          <div className="cf-card p-4 min-w-0">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <FolderLock className="w-4 h-4 text-[#059669]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F1B33]">
                  Evidence artifacts ({evidenceList.length})
                </h2>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-[#059669] border border-emerald-200 text-[11px] font-semibold">
                <Lock className="w-2.5 h-2.5" />
                Sealed
              </span>
            </div>

            <div className="space-y-2">
              {displayEvidence.length === 0 ? (
                <div className="p-3 rounded-xl bg-[#F8FAFD] border border-[#E2E8F1] text-xs text-[#5B6B85]">
                  No evidence files recorded for this case yet.
                </div>
              ) : (
                displayEvidence.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => {
                      onSelectEvidenceForVault(ev.id);
                      onNavigateTab('EVIDENCE');
                    }}
                    className="p-2.5 rounded-xl bg-[#F8FAFD] border border-[#E2E8F1] hover:border-[#2563EB] transition cursor-pointer min-w-0 group"
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-xs font-semibold text-[#0F1B33] group-hover:text-[#2563EB] transition truncate">
                        {ev.originalFilename}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                        {ev.evidenceCode}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#5B6B85] mt-0.5">
                      <span className="truncate">{ev.evidenceCategory || 'DOCUMENT'}</span>
                      <span className="tabular-nums shrink-0 ml-2">
                        {ev.fileSizeBytes > 0
                          ? `${Math.max(1, Math.round(ev.fileSizeBytes / 1024))} KB`
                          : 'Metadata only'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. Full-Width "Open Connection Graph" CTA */}
          <button
            type="button"
            onClick={() => onNavigateTab('GRAPH')}
            className="w-full py-2.5 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
          >
            <Network className="w-4 h-4" />
            <span>Open connection graph</span>
            <ArrowRight className="w-3.5 h-3.5 ml-auto" />
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          ROW 3: CASE NARRATIVE SPINE ("What happened" 4-Step Sequence)
      ════════════════════════════════════════════════════════════════════════ */}
      <section className="cf-card p-5 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F1B33]">
              What happened · Chronological sequence
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('TIMELINE')}
            className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer"
          >
            <span>View full timeline</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* 4-Step Sequence Spine */}
        {narrativeSteps.length === 0 ? (
          <div className="p-4 rounded-2xl bg-[#F8FAFD] border border-[#E2E8F1] text-xs text-[#5B6B85]">
            No timeline events recorded for this case yet. Open the Timeline stage to add steps.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative min-w-0">
            {narrativeSteps.map((step, idx) => {
              const isAnomaly = !!step.anomalyFlag;
              return (
                <div
                  key={step.id || idx}
                  onClick={() => onNavigateTab('TIMELINE')}
                  className="relative p-4 rounded-2xl bg-[#F8FAFD] border border-[#E2E8F1] hover:border-[#2563EB] transition cursor-pointer flex flex-col justify-between space-y-2.5 min-w-0 group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-[#5B6B85] uppercase tracking-wider">
                        {step.killChainPhase || `STEP 0${idx + 1}`}
                      </span>
                    </div>

                    {isAnomaly ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-[#D97706] border border-amber-200 text-[10px] font-semibold">
                        <AlertTriangle className="w-3 h-3" />
                        Warning
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[#2563EB] text-[10px] font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        Recorded
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <h3 className="text-xs font-bold text-[#0F1B33] group-hover:text-[#2563EB] transition leading-snug line-clamp-2">
                      {step.title}
                    </h3>
                    <p className="text-[11px] text-[#5B6B85] leading-relaxed line-clamp-3">
                      {step.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 text-[11px] font-mono text-slate-500 flex items-center justify-between">
                    <span>
                      {step.eventTimestamp
                        ? new Date(step.eventTimestamp).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'UTC',
                          }) + ' UTC'
                        : 'Date not recorded'}
                    </span>
                    <span className="text-xs text-slate-400 group-hover:text-[#2563EB] transition">
                      →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default ExecutiveDashboardView;
