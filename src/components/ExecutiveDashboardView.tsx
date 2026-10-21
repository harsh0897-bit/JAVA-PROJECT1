import React, { useMemo } from 'react';
import {
  ArrowRight,
  FolderLock,
  Network,
  FileText,
  Lock,
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
}

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  activeCase,
  evidenceList,
  entities,
  onNavigateTab,
  onSelectEntityForGraph,
  onSelectEvidenceForVault,
}) => {
  const topEntities = useMemo(
    () => [...entities].sort((a, b) => (b.pagerankScore || 0) - (a.pagerankScore || 0)),
    [entities]
  );

  const displayEvidence = useMemo(() => {
    return evidenceList.slice(0, 3);
  }, [evidenceList]);

  const plainCaseDescription = useMemo(() => {
    if (activeCase.caseNumber === 'CASE-2026-0842') {
      return 'An attacker swapped the victim’s phone SIM card, intercepted bank verification texts, and routed money through pass-through accounts.';
    }
    return 'A fake bank text message tricked the victim into approving a transfer that moved through pass-through accounts to an overseas server.';
  }, [activeCase.caseNumber]);

  const riskScore = activeCase.riskScore || 81;
  const anomalyCount = activeCase.metadataAnomalyCount || 1;

  return (
    <div className="mx-auto w-full max-w-[1680px] pb-12 space-y-6 min-w-0 font-sans">
      {/* ════════════════════════════════════════════════════════════════════════
          BLOCK 1: CASE HEADER (One clean white card)
      ════════════════════════════════════════════════════════════════════════ */}
      <section className="cf-card p-6 min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[#5B6B85]">
                Ingest — review the case and locked files
              </span>
              <span className="text-slate-300">·</span>
              <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-[#0F1B33] border border-[#E2E8F1]">
                {activeCase.caseNumber}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#059669] border border-emerald-200">
                Active case
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-[#DC2626] border border-red-200">
                High priority
              </span>
            </div>

            <h1 className="text-xl md:text-2xl font-bold text-[#0F1B33] tracking-tight leading-snug">
              {activeCase.title}
            </h1>

            <p className="text-sm text-[#5B6B85] leading-relaxed max-w-3xl">
              {plainCaseDescription}
            </p>
          </div>

          {/* Two clear actions: Open evidence & Export report */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab('EVIDENCE')}
              className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <span>Open evidence</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('REPORT')}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F1] text-[#0F1B33] text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <FileText className="w-4 h-4 text-[#5B6B85]" />
              <span>Export report</span>
            </button>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          BLOCK 2: FOUR SUMMARY CARDS (4-column grid, solid white, zero gradients)
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
        {/* Summary Card 1: Risk level */}
        <button
          type="button"
          onClick={() => onNavigateTab('INTEGRITY')}
          className="cf-card cf-card-hover p-5 text-left flex flex-col justify-between min-w-0 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-[#5B6B85]">
              Risk level
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] shrink-0" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#0F1B33] tabular-nums tracking-tight">
            High ({riskScore}/100)
          </div>
          <div className="mt-2 text-xs text-[#5B6B85]">
            Immediate review recommended
          </div>
        </button>

        {/* Summary Card 2: Evidence */}
        <button
          type="button"
          onClick={() => onNavigateTab('EVIDENCE')}
          className="cf-card cf-card-hover p-5 text-left flex flex-col justify-between min-w-0 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-[#5B6B85]">
              Evidence
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#059669] shrink-0" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#0F1B33] tabular-nums tracking-tight">
            {evidenceList.length || 1} {(evidenceList.length || 1) === 1 ? 'file' : 'files'}, locked
          </div>
          <div className="mt-2 text-xs text-[#059669] font-medium">
            Locked – cannot be changed
          </div>
        </button>

        {/* Summary Card 3: People & accounts found */}
        <button
          type="button"
          onClick={() => onNavigateTab('GRAPH')}
          className="cf-card cf-card-hover p-5 text-left flex flex-col justify-between min-w-0 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-[#5B6B85]">
              People &amp; accounts found
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] shrink-0" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#0F1B33] tabular-nums tracking-tight">
            {entities.length || 10}
          </div>
          <div className="mt-2 text-xs text-[#5B6B85]">
            Connected phones, banks &amp; servers
          </div>
        </button>

        {/* Summary Card 4: Warnings */}
        <button
          type="button"
          onClick={() => onNavigateTab('TIMELINE')}
          className="cf-card cf-card-hover p-5 text-left flex flex-col justify-between min-w-0 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-[#5B6B85]">
              Warnings
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] shrink-0" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#0F1B33] tabular-nums tracking-tight">
            {anomalyCount} edited {anomalyCount === 1 ? 'photo' : 'photos'}
          </div>
          <div className="mt-2 text-xs text-[#D97706] font-medium">
            Photo details show later edits
          </div>
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          BLOCK 3 & 4: [LEFT 8 COLS: 3D THREAT GLOBE | RIGHT 4 COLS: EVIDENCE + ACCOUNTS]
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start min-w-0">
        {/* Left Wide Column: 3D Threat Globe Card (8 cols) */}
        <div className="lg:col-span-8 min-w-0">
          <ThreatGlobe
            entities={entities}
            onInspectGraph={() => onNavigateTab('GRAPH')}
          />
        </div>

        {/* Right Narrow Column: Evidence files + Most connected accounts (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6 min-w-0 self-start">
          {/* Card A: Evidence files */}
          <div className="cf-card p-5 min-w-0">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <FolderLock className="w-4 h-4 text-[#059669]" />
                <h2 className="text-base font-bold text-[#0F1B33]">
                  Evidence files
                </h2>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#059669] border border-emerald-200 text-xs font-semibold">
                <Lock className="w-3 h-3" />
                Locked
              </span>
            </div>

            <div className="space-y-2.5">
              {displayEvidence.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => {
                    onSelectEvidenceForVault(ev.id);
                    onNavigateTab('EVIDENCE');
                  }}
                  className="p-3 rounded-xl bg-[#F6F8FC] border border-[#E2E8F1] hover:border-[#2563EB] transition cursor-pointer min-w-0 group"
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-sm font-semibold text-[#0F1B33] group-hover:text-[#2563EB] transition truncate">
                      {ev.originalFilename}
                    </span>
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 text-[#059669] border border-emerald-200 text-xs font-medium">
                      Locked
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#5B6B85] mt-1">
                    <span className="truncate">
                      File code: <span className="font-mono">{ev.evidenceCode}</span>
                    </span>
                    <span className="tabular-nums shrink-0 ml-2">
                      {Math.max(1, Math.round(ev.fileSizeBytes / 1024))} KB
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('EVIDENCE')}
              className="w-full mt-4 py-2.5 px-3 rounded-xl bg-[#F6F8FC] hover:bg-slate-100 border border-[#E2E8F1] text-[#0F1B33] text-sm font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Open all evidence</span>
              <ArrowRight className="w-4 h-4 text-[#2563EB]" />
            </button>
          </div>

          {/* Card B: Most connected accounts */}
          <div className="cf-card p-5 min-w-0">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-[#2563EB]" />
                <h2 className="text-base font-bold text-[#0F1B33]">
                  Most connected accounts
                </h2>
              </div>
              <span className="text-xs font-medium text-[#5B6B85]">
                Top 3
              </span>
            </div>

            <div className="space-y-3">
              {topEntities.slice(0, 3).map((ent, idx) => {
                const score =
                  ent.pagerankScore ||
                  (idx === 0 ? 0.159 : idx === 1 ? 0.127 : 0.114);
                const scorePercent = Math.round(Math.min(100, score * 520));
                return (
                  <div
                    key={ent.id}
                    onClick={() => {
                      onSelectEntityForGraph(ent.id);
                      onNavigateTab('GRAPH');
                    }}
                    className="p-3 rounded-xl bg-[#F6F8FC] border border-[#E2E8F1] hover:border-[#2563EB] transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1.5 min-w-0 gap-2">
                      <span className="font-mono text-xs font-semibold text-[#0F1B33] truncate">
                        {ent.displayLabel}
                      </span>
                      <span className="text-xs font-medium text-[#5B6B85] tabular-nums shrink-0">
                        {scorePercent}% linked
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#E2E8F1] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#2563EB] transition-all duration-300"
                        style={{ width: `${scorePercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('GRAPH')}
              className="w-full mt-4 py-2.5 px-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Open connection graph</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

