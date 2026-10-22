import React, { useState, useMemo } from 'react';
import {
  FileDown,
  FileCode2,
  FileText,
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Check,
  Copy,
  FileSignature,
} from 'lucide-react';
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
import { copyToClipboardSafe } from '../lib/clipboard';
import { DropletTabs, DropletTabItem } from './ui/DropletTabs';
import {
  buildReportModel,
  generateReportPdfBytes,
  generateReportMarkdown,
  generateReportCsv,
  buildSanitizedReportFilename,
  triggerSafeBlobDownload,
} from '../lib/reportBuilder';

interface ForensicReportViewProps {
  activeCase: ForensicCaseSummary;
  evidenceList?: EvidenceItem[];
  entities?: ExtractedEntity[];
  relationships?: EntityRelationship[];
  timeline?: TimelineEvent[];
  verifications?: IntegrityVerification[];
  ledger?: ChainOfCustodyEntry[];
  chainVerification?: any | null;
  currentUser?: UserProfile | null;
}

const PREVIEW_TABS: DropletTabItem[] = [
  { id: 'JSON', label: 'JSON' },
  { id: 'TEXT', label: 'Text' },
];

export const ForensicReportView: React.FC<ForensicReportViewProps> = ({
  activeCase,
  evidenceList = [],
  entities = [],
  relationships = [],
  timeline = [],
  verifications = [],
  ledger = [],
  chainVerification = null,
  currentUser = null,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [codePreviewMode, setCodePreviewMode] = useState<'JSON' | 'TEXT'>('JSON');
  const [exportingFormat, setExportingFormat] = useState<
    'PDF' | 'JSON' | 'MD' | 'CSV' | null
  >(null);

  const reportModel = useMemo(
    () =>
      buildReportModel({
        activeCase,
        evidenceList,
        entities,
        relationships,
        timeline,
        verifications,
        ledger,
        chainVerification,
        currentUser,
      }),
    [
      activeCase,
      evidenceList,
      entities,
      relationships,
      timeline,
      verifications,
      ledger,
      chainVerification,
      currentUser,
    ]
  );

  const jsonBundlePreview = useMemo(
    () => JSON.stringify(reportModel, null, 2),
    [reportModel]
  );

  const plainTextPreview = useMemo(
    () => generateReportMarkdown(reportModel),
    [reportModel]
  );

  const handleCopy = async (text: string, key: string) => {
    if (await copyToClipboardSafe(text)) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const yieldFrame = () =>
    new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });

  const handleDownloadPdf = async () => {
    if (exportingFormat) return;
    setExportingFormat('PDF');
    try {
      await yieldFrame();
      const freshModel = buildReportModel({
        activeCase,
        evidenceList,
        entities,
        relationships,
        timeline,
        verifications,
        ledger,
        chainVerification,
        currentUser,
      });
      const pdfResult = await generateReportPdfBytes(freshModel);
      const blob = new Blob([pdfResult.bytes as unknown as BlobPart], {
        type: 'application/pdf',
      });
      const filename = buildSanitizedReportFilename(
        freshModel.metadata.caseNumber,
        freshModel.metadata.generatedAtUtc,
        'pdf'
      );
      triggerSafeBlobDownload(blob, filename);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleDownloadJson = async () => {
    if (exportingFormat) return;
    setExportingFormat('JSON');
    try {
      await yieldFrame();
      const freshModel = buildReportModel({
        activeCase,
        evidenceList,
        entities,
        relationships,
        timeline,
        verifications,
        ledger,
        chainVerification,
        currentUser,
      });
      const jsonText = JSON.stringify(freshModel, null, 2);
      const blob = new Blob([jsonText], {
        type: 'application/json;charset=utf-8',
      });
      const filename = buildSanitizedReportFilename(
        freshModel.metadata.caseNumber,
        freshModel.metadata.generatedAtUtc,
        'json'
      );
      triggerSafeBlobDownload(blob, filename);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleDownloadMarkdown = async () => {
    if (exportingFormat) return;
    setExportingFormat('MD');
    try {
      await yieldFrame();
      const freshModel = buildReportModel({
        activeCase,
        evidenceList,
        entities,
        relationships,
        timeline,
        verifications,
        ledger,
        chainVerification,
        currentUser,
      });
      const mdText = generateReportMarkdown(freshModel);
      const blob = new Blob([mdText], {
        type: 'text/markdown;charset=utf-8',
      });
      const filename = buildSanitizedReportFilename(
        freshModel.metadata.caseNumber,
        freshModel.metadata.generatedAtUtc,
        'md'
      );
      triggerSafeBlobDownload(blob, filename);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleDownloadCsv = async () => {
    if (exportingFormat) return;
    setExportingFormat('CSV');
    try {
      await yieldFrame();
      const freshModel = buildReportModel({
        activeCase,
        evidenceList,
        entities,
        relationships,
        timeline,
        verifications,
        ledger,
        chainVerification,
        currentUser,
      });
      const csvText = generateReportCsv(freshModel);
      const blob = new Blob([csvText], {
        type: 'text/csv;charset=utf-8',
      });
      const filename = buildSanitizedReportFilename(
        freshModel.metadata.caseNumber,
        freshModel.metadata.generatedAtUtc,
        'csv'
      );
      triggerSafeBlobDownload(blob, filename);
    } finally {
      setExportingFormat(null);
    }
  };

  const checklistItems = useMemo(
    () => [
      {
        title: 'Original files locked on upload',
        detail:
          reportModel.evidence.length > 0
            ? `${reportModel.integrity.verifiedIntactCount} of ${reportModel.evidence.length} evidence files verified intact since upload.`
            : 'No evidence files uploaded yet for this case.',
        ready:
          reportModel.evidence.length > 0 &&
          reportModel.integrity.tamperedCount === 0,
      },
      {
        title: 'Digital fingerprints match (SHA-256)',
        detail:
          reportModel.integrity.tamperedCount === 0 &&
          reportModel.evidence.length > 0
            ? 'Every ingested file matches its recorded 64-character SHA-256 fingerprint.'
            : reportModel.integrity.tamperedCount > 0
            ? `${reportModel.integrity.tamperedCount} file(s) flagged with fingerprint mismatch.`
            : 'Awaiting evidence fingerprint verification.',
        ready:
          reportModel.evidence.length > 0 &&
          reportModel.integrity.tamperedCount === 0,
      },
      {
        title: 'Metadata & timestamp anomalies disclosed',
        detail:
          reportModel.warnings.length > 0
            ? `${reportModel.warnings.length} metadata/timestamp finding(s) documented in Section 7.`
            : 'Zero undisclosed metadata or timestamp discrepancies detected.',
        ready: true,
      },
      {
        title: 'Money trail and accounts mapped',
        detail:
          reportModel.entities.length > 0
            ? `${reportModel.entities.length} entities and ${reportModel.relationships.length} relationship links correlated.`
            : 'No entities or account links correlated yet.',
        ready: reportModel.entities.length > 0,
      },
      {
        title: 'Complete activity log attached',
        detail:
          reportModel.integrity.custodyEntries.length > 0
            ? `${reportModel.integrity.custodyEntries.length} chain-of-custody entries recorded in order.`
            : 'Chain-of-custody log initialized.',
        ready: reportModel.integrity.custodyEntries.length > 0,
      },
    ],
    [reportModel]
  );

  const readyChecklistCount = checklistItems.filter((c) => c.ready).length;

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 lg:px-8 pb-12 space-y-6 min-w-0">
      {/* =========================================================================
          1. CLEAN REPORT HEADER WITH FLAT STATIC ROUND "VERIFIED" SEAL & ACTIONS
          ========================================================================= */}
      <div className="cf-card p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 min-w-0">
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          {/* Flat, static round "Verified" seal badge (no tilt/parallax) */}
          <div className="w-16 h-16 rounded-full bg-[#E7F6EF] border-2 border-[#129960] flex flex-col items-center justify-center shrink-0 select-none">
            <ShieldCheck className="w-6 h-6 text-[#129960]" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#0E6B45] mt-0.5">
              Verified
            </span>
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 font-mono">
                6 · Report
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-xs text-slate-500">
                {reportModel.metadata.caseNumber}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
              Case Report &amp; Court Summary
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
              Complete case summary with locked evidence fingerprints, step-by-step timeline, and investigator sign-off.
            </p>
          </div>
        </div>

        {/* Export Actions: Primary Download PDF; Secondary Download JSON, Download Markdown, Download CSV, Copy */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={exportingFormat !== null}
            onClick={handleDownloadPdf}
            className="cf-btn-blue h-10 px-4 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>
              {exportingFormat === 'PDF' ? 'Generating PDF…' : 'Download PDF'}
            </span>
          </button>

          <button
            type="button"
            disabled={exportingFormat !== null}
            onClick={handleDownloadJson}
            className="h-10 px-3.5 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <FileCode2 className="w-4 h-4 text-blue-600" />
            <span>
              {exportingFormat === 'JSON' ? 'Exporting…' : 'Download JSON'}
            </span>
          </button>

          <button
            type="button"
            disabled={exportingFormat !== null}
            onClick={handleDownloadMarkdown}
            className="h-10 px-3.5 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>
              {exportingFormat === 'MD' ? 'Exporting…' : 'Download Markdown'}
            </span>
          </button>

          <button
            type="button"
            disabled={exportingFormat !== null}
            onClick={handleDownloadCsv}
            className="h-10 px-3.5 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            <span>
              {exportingFormat === 'CSV' ? 'Exporting…' : 'Download CSV'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleCopy(plainTextPreview, 'dossierCopy')}
            className="h-10 px-3.5 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            {copiedKey === 'dossierCopy' ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. TWO-COLUMN REPORT LAYOUT
          Left 8 Cols: Clean Case Report Document
          Right 4 Cols: Sticky Card 1 ("Is this ready for court?") + Sticky Card 2 (JSON | Text)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 items-start gap-6 min-w-0">
        {/* ===================================================================
            LEFT 8 COLUMNS: CASE REPORT DOCUMENT
            =================================================================== */}
        <div className="cf-card lg:col-span-8 p-6 sm:p-8 space-y-7 min-w-0">
          {/* Case Overview Grid */}
          <div className="border-b border-slate-100 pb-6 space-y-4 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Official Case Summary • {reportModel.metadata.dataSourceClassification}
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5 break-words">
                  {reportModel.metadata.caseName}
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#E7F6EF] text-[#0E6B45] shrink-0">
                Ready for review
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#F6F8FC] p-3 rounded-xl border border-slate-200/80 min-w-0">
                <span className="text-slate-400 text-[11px] block">
                  Lead investigator
                </span>
                <span className="text-slate-900 font-bold truncate block mt-0.5">
                  {reportModel.metrics.leadInvestigator}
                </span>
              </div>
              <div className="bg-[#F6F8FC] p-3 rounded-xl border border-slate-200/80 min-w-0">
                <span className="text-slate-400 text-[11px] block">Victim</span>
                <span className="text-slate-900 font-bold truncate block mt-0.5">
                  {reportModel.metrics.victimName}
                </span>
              </div>
              <div className="bg-[#F6F8FC] p-3 rounded-xl border border-slate-200/80 min-w-0">
                <span className="text-slate-400 text-[11px] block">
                  Amount involved
                </span>
                <span className="text-slate-900 font-bold block mt-0.5 tabular-nums">
                  {reportModel.metrics.recordedCaseLossUsd}
                </span>
              </div>
              <div className="bg-[#F6F8FC] p-3 rounded-xl border border-slate-200/80 min-w-0">
                <span className="text-slate-400 text-[11px] block">
                  Report date
                </span>
                <span className="text-slate-900 font-bold block mt-0.5 font-mono tabular-nums">
                  {reportModel.metadata.generatedAtUtc.slice(0, 10)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: What Happened (Executive Summary) */}
          <div className="space-y-3 min-w-0">
            <h3 className="text-sm font-bold text-slate-900">
              1. What Happened
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-[#F6F8FC] p-4 rounded-xl border border-slate-200/80">
              {reportModel.summary.whatHappened}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-[#F6F8FC] px-3 py-2 rounded-lg border border-slate-200/80">
                <span className="text-slate-400 text-[11px] block">Risk Score</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {reportModel.metrics.riskScore} ({reportModel.metrics.severity})
                </span>
              </div>
              <div className="bg-[#F6F8FC] px-3 py-2 rounded-lg border border-slate-200/80">
                <span className="text-slate-400 text-[11px] block">Timeline Steps</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {reportModel.metrics.timelineStepCount} events
                </span>
              </div>
              <div className="bg-[#F6F8FC] px-3 py-2 rounded-lg border border-slate-200/80">
                <span className="text-slate-400 text-[11px] block">Mapped Entities</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {reportModel.entities.length} nodes / {reportModel.relationships.length} links
                </span>
              </div>
              <div className="bg-[#F6F8FC] px-3 py-2 rounded-lg border border-slate-200/80">
                <span className="text-slate-400 text-[11px] block">Integrity Verdict</span>
                <span className="font-mono font-bold text-emerald-700">
                  {reportModel.integrity.verifiedIntactCount}/{reportModel.integrity.totalEvidenceCount} Intact
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Key Steps in Order (Chronological Timeline) */}
          <div className="space-y-3 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                2. Key Steps in Order ({reportModel.timeline.length})
              </h3>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {reportModel.financialSummary.currencySubtotals
                  .map((s) => `${s.currency}: ${s.formattedSubtotal}`)
                  .join(' • ') || reportModel.metrics.recordedCaseLossUsd}
              </span>
            </div>

            {reportModel.timeline.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#F6F8FC] border border-slate-200/80 text-xs text-slate-500">
                No timeline events recorded for this case yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {reportModel.timeline.map((step) => (
                  <div
                    key={step.id}
                    className="p-3.5 rounded-xl bg-[#F6F8FC] border border-slate-200/80 space-y-1 min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-bold ${
                          step.hasWarning ? 'text-[#9A5B13]' : 'text-blue-700'
                        }`}
                      >
                        Step {step.stepNumber} • {step.recordedTimestamp.slice(11, 19) || step.recordedTimestamp}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {step.linkedEvidenceCode}
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 break-words">
                      {step.eventTitle}
                    </div>
                    <p className="text-slate-600 leading-snug break-words">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Evidence Files Included */}
          <div className="space-y-3 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                3. Evidence Files Included ({reportModel.evidence.length})
              </h3>
              <span className="text-xs font-semibold text-emerald-700 tabular-nums">
                {reportModel.integrity.verifiedIntactCount} /{' '}
                {reportModel.evidence.length} files locked
              </span>
            </div>

            {reportModel.evidence.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#F6F8FC] border border-slate-200/80 text-xs text-slate-500">
                No evidence artifacts ingested for this case yet.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden min-w-0">
                <div className="overflow-x-auto min-w-0">
                  <table className="w-full text-left text-xs min-w-[540px]">
                    <thead>
                      <tr className="bg-[#F6F8FC] border-b border-slate-200 text-[11px] text-slate-500">
                        <th className="py-2.5 px-3 font-semibold">Code</th>
                        <th className="py-2.5 px-3 font-semibold">File name</th>
                        <th className="py-2.5 px-3 font-semibold">Size</th>
                        <th className="py-2.5 px-3 font-semibold">
                          Fingerprint (SHA-256)
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-right">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportModel.evidence.map((ev) => (
                        <tr key={ev.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                            {ev.evidenceCode}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 break-all max-w-xs">
                            {ev.filename}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap tabular-nums">
                            {ev.sizeFormatted}
                          </td>
                          <td
                            className="py-2.5 px-3 font-mono text-[11px] text-slate-600 break-all"
                            title={ev.sha256Fingerprint}
                          >
                            {ev.sha256Fingerprint}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                ev.verificationStatus.startsWith('TAMPER_DETECTED')
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-[#E7F6EF] text-[#0E6B45]'
                              }`}
                            >
                              {ev.verificationStatus.startsWith('TAMPER_DETECTED')
                                ? 'Tampered !'
                                : 'Locked ✓'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Entity & Graph Summary + Key Findings */}
          <div className="space-y-3 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                4. Correlated Entities &amp; Key Findings
              </h3>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {reportModel.entities.length} entities •{' '}
                {reportModel.relationships.length} relationships
              </span>
            </div>

            {reportModel.entities.length > 0 && (
              <div className="flex flex-wrap gap-2 font-mono text-xs">
                {reportModel.entities.slice(0, 6).map((ent) => (
                  <span
                    key={ent.id}
                    className="bg-[#F6F8FC] text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 break-all select-all"
                  >
                    {ent.plainCategory}: <strong>{ent.displayLabel}</strong> (
                    {ent.confidencePct})
                  </span>
                ))}
              </div>
            )}

            <div className="rounded-xl bg-[#F6F8FC] border border-slate-200/80 p-3.5 space-y-1.5 text-xs">
              <div className="font-bold text-slate-800">
                Principal Risk: {reportModel.summary.principalRisk}
              </div>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                {reportModel.warnings.map((w) => (
                  <li key={w.id} className="leading-snug break-words">
                    <strong>{w.sourceRef} ({w.category}):</strong> {w.whatWasFound}
                  </li>
                ))}
                {reportModel.conclusion.nextReviewPoints.map((pt, idx) => (
                  <li key={`pt-${idx}`} className="leading-snug break-words">
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Section 5: Investigator Sign-Off */}
          <div className="space-y-3 min-w-0">
            <h3 className="text-sm font-bold text-slate-900">
              5. Investigator Sign-Off &amp; Chain-of-Custody Attestation
            </h3>
            <div className="rounded-xl bg-[#F6F8FC] border border-slate-200/80 p-5 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
                <div className="flex items-center gap-2">
                  <FileSignature className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-slate-900 text-sm">
                    Signed by: {reportModel.metrics.leadInvestigator}
                  </span>
                </div>
                <span className="text-blue-700 font-semibold text-xs">
                  {reportModel.metadata.preparedBy}
                </span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                {reportModel.conclusion.summaryStatement}
              </p>
              <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
                <span className="break-all">
                  Report Seal:{' '}
                  <strong className="text-emerald-700 select-all">
                    {reportModel.integrity.headMerkleHash}
                  </strong>
                </span>
                <span className="text-emerald-700 font-bold shrink-0">
                  {reportModel.integrity.custodyEntries.length} custody entries ✓
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================
            RIGHT 4 COLUMNS: STICKY CARD 1 ("Is this ready for court?") + STICKY CARD 2 (JSON | Text)
            =================================================================== */}
        <aside className="lg:col-span-4 space-y-5 min-w-0 self-start lg:sticky lg:top-[calc(var(--shell-h,148px)+16px)]">
          {/* Right Sticky Card 1: "Is this ready for court?" (5-item checklist) */}
          <div className="cf-card p-5 space-y-4 min-w-0">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Is this ready for court?
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E7F6EF] text-[#0E6B45] tabular-nums">
                {readyChecklistCount} / {checklistItems.length} Ready
              </span>
            </div>

            <div className="space-y-2.5">
              {checklistItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#F6F8FC] border border-slate-200/80 flex items-start gap-2.5 min-w-0"
                >
                  {item.ready ? (
                    <CheckCircle2 className="w-4 h-4 text-[#129960] shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                      {item.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Sticky Card 2: Preview with Spring Switcher (JSON | Text) */}
          <div className="cf-card p-5 space-y-3.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <DropletTabs
                variant="compact"
                ariaLabel="Report code preview format"
                idPrefix="report-preview"
                items={PREVIEW_TABS}
                value={codePreviewMode}
                onChange={(id) => setCodePreviewMode(id as 'JSON' | 'TEXT')}
              />

              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    codePreviewMode === 'JSON'
                      ? jsonBundlePreview
                      : plainTextPreview,
                    'previewCopy'
                  )
                }
                className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copiedKey === 'previewCopy' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Light (#F6F8FC, dark text, monospace 13px), scrolls inside the card, never wider than it */}
            <pre className="p-3.5 rounded-xl bg-[#F6F8FC] border border-slate-200/80 font-mono text-[13px] text-slate-900 leading-relaxed max-h-[360px] overflow-y-auto overflow-x-auto max-w-full whitespace-pre-wrap break-words select-all">
              {codePreviewMode === 'JSON' ? jsonBundlePreview : plainTextPreview}
            </pre>
          </div>
        </aside>
      </div>
    </div>
  );
};

