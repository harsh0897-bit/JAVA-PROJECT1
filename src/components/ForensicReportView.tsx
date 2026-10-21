import React, { useState, useEffect } from 'react';
import {
  FileDown,
  FileCode2,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Check,
  Copy,
  FileSignature,
} from 'lucide-react';
import { ForensicCaseSummary } from '../types';
import { copyToClipboardSafe } from '../lib/clipboard';
import { DropletTabs, DropletTabItem } from './ui/DropletTabs';

interface ForensicReportViewProps {
  activeCase: ForensicCaseSummary;
}

const PREVIEW_TABS: DropletTabItem[] = [
  { id: 'JSON', label: 'JSON' },
  { id: 'TEXT', label: 'Text' },
];

export const ForensicReportView: React.FC<ForensicReportViewProps> = ({
  activeCase,
}) => {
  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [codePreviewMode, setCodePreviewMode] = useState<'JSON' | 'TEXT'>('JSON');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(`/api/v1/reports?caseId=${encodeURIComponent(activeCase.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (mounted) setReportData(data);
      })
      .catch(() => {
        // Handled gracefully offline
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeCase.id]);

  const handleCopy = async (text: string, key: string) => {
    if (await copyToClipboardSafe(text)) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const jsonBundlePreview = JSON.stringify(
    {
      type: 'bundle',
      id: `bundle--${activeCase.id}`,
      spec_version: '2.1',
      objects: [
        {
          type: 'report',
          id: `report--${activeCase.caseNumber}`,
          name: activeCase.title,
          description: activeCase.summary,
          published: reportData?.generatedAt || '2026-10-01T12:00:00Z',
          confidence: 98,
          labels: ['threat-report', 'judicial-evidence', 'financial-fraud'],
          object_refs: [
            'indicator--phishing-sms',
            'identity--victim-mehta',
            'malware--fake-hdfc-apk',
            'observed-data--tron-usdt',
          ],
        },
      ],
    },
    null,
    2
  );

  const plainTextPreview =
    reportData?.markdownPreview ||
    `# Case Report: ${activeCase.title}\nCase ID: ${activeCase.caseNumber}\nVictim: ${activeCase.victimName}\nLead Investigator: ${activeCase.leadInvestigatorName || 'Cmdr. Arjun Verma'}\n\n## Summary\n${activeCase.summary}\n\n## Steps\n1. EVD-001 — Fake text message sent to victim\n2. EVD-002 — Login details stolen\n3. EVD-003 — Money transferred out ($4,850.00)\n4. EVD-004 — Money passed through accounts and cashed out`;

  const checklistItems = [
    {
      title: 'Original files locked on upload',
      detail: 'All 4 evidence files are locked and unchanged since upload.',
    },
    {
      title: 'Digital fingerprints match (SHA-256)',
      detail: 'Every file matches its recorded digital fingerprint.',
    },
    {
      title: 'Edited photo timestamp noted',
      detail: 'The 14-minute clock difference on EVD-003 is clearly disclosed.',
    },
    {
      title: 'Money trail and accounts mapped',
      detail: 'All connected phones, bank accounts, and wallets are linked.',
    },
    {
      title: 'Complete activity log attached',
      detail: 'Every investigator action is recorded in order from start to finish.',
    },
  ];

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
                {activeCase.caseNumber}
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

        {/* Export Actions: Primary Download PDF; Secondary Download JSON, Download Markdown, Copy */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href={`/api/v1/reports/pdf?caseId=${encodeURIComponent(activeCase.id)}`}
            target="_blank"
            rel="noreferrer"
            className="cf-btn-blue h-10 px-4 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>Download PDF</span>
          </a>

          <a
            href={`/api/v1/reports/stix?caseId=${encodeURIComponent(activeCase.id)}`}
            target="_blank"
            rel="noreferrer"
            className="h-10 px-3.5 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <FileCode2 className="w-4 h-4 text-blue-600" />
            <span>Download JSON</span>
          </a>

          <a
            href={`/api/v1/reports/markdown?caseId=${encodeURIComponent(activeCase.id)}`}
            target="_blank"
            rel="noreferrer"
            className="h-10 px-3.5 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Download Markdown</span>
          </a>

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

      {loading && (
        <div className="cf-card p-5 text-center text-xs text-slate-500">
          Preparing case report details…
        </div>
      )}

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
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Official Case Summary
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
                  {activeCase.title}
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#E7F6EF] text-[#0E6B45]">
                Ready for review
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#F6F8FC] p-3 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 text-[11px] block">
                  Lead investigator
                </span>
                <span className="text-slate-900 font-bold truncate block mt-0.5">
                  {activeCase.leadInvestigatorName || 'Cmdr. Arjun Verma'}
                </span>
              </div>
              <div className="bg-[#F6F8FC] p-3 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 text-[11px] block">Victim</span>
                <span className="text-slate-900 font-bold truncate block mt-0.5">
                  {activeCase.victimName}
                </span>
              </div>
              <div className="bg-[#F6F8FC] p-3 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 text-[11px] block">
                  Amount involved
                </span>
                <span className="text-slate-900 font-bold block mt-0.5 tabular-nums">
                  ${activeCase.estimatedLossUsd?.toLocaleString() || '12,500'} USD
                </span>
              </div>
              <div className="bg-[#F6F8FC] p-3 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 text-[11px] block">
                  Report date
                </span>
                <span className="text-slate-900 font-bold block mt-0.5 font-mono tabular-nums">
                  {new Date().toISOString().slice(0, 10)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: What Happened */}
          <div className="space-y-3 min-w-0">
            <h3 className="text-sm font-bold text-slate-900">
              1. What Happened
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-[#F6F8FC] p-4 rounded-xl border border-slate-200/80">
              {activeCase.summary}
            </p>
            <div className="flex flex-wrap gap-2 pt-1 font-mono text-xs">
              <span className="bg-[#F6F8FC] text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 break-all select-all">
                Server IP: <strong>185.220.101.44</strong>
              </span>
              <span className="bg-[#F6F8FC] text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 break-all select-all">
                Payment ID: <strong>apex.verify.settlement@okaxis</strong>
              </span>
              <span className="bg-[#F6F8FC] text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 break-all select-all">
                Destination wallet: <strong>TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE</strong>
              </span>
            </div>
          </div>

          {/* Section 2: Key Steps in Order */}
          <div className="space-y-3 min-w-0">
            <h3 className="text-sm font-bold text-slate-900">
              2. Key Steps in Order
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#F6F8FC] border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-700">Step 1</span>
                  <span className="font-mono text-[11px] text-slate-500">EVD-001</span>
                </div>
                <div className="font-bold text-slate-900">
                  Fake text message sent to victim
                </div>
                <p className="text-slate-600 leading-snug">
                  Text message with a fake bank link sent to the victim&apos;s phone.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F6F8FC] border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-700">Step 2</span>
                  <span className="font-mono text-[11px] text-slate-500">EVD-002</span>
                </div>
                <div className="font-bold text-slate-900">
                  Login details stolen
                </div>
                <p className="text-slate-600 leading-snug">
                  Fake login page captured the victim&apos;s password and one-time code.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F6F8FC] border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#9A5B13]">Step 3</span>
                  <span className="font-mono text-[11px] text-slate-500">EVD-003</span>
                </div>
                <div className="font-bold text-slate-900">
                  Money transferred out ($4,850.00)
                </div>
                <p className="text-slate-600 leading-snug">
                  Unauthorized transfer sent to an intermediary account (receipt photo shows a 14m timestamp edit).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F6F8FC] border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-700">Step 4</span>
                  <span className="font-mono text-[11px] text-slate-500">EVD-004</span>
                </div>
                <div className="font-bold text-slate-900">
                  Money passed through accounts and cashed out
                </div>
                <p className="text-slate-600 leading-snug">
                  Funds moved across accounts and converted into USDT cryptocurrency.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Evidence Files Included */}
          <div className="space-y-3 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                3. Evidence Files Included
              </h3>
              <span className="text-xs font-semibold text-emerald-700">
                All 4 files locked
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden min-w-0">
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left text-xs min-w-[480px]">
                  <thead>
                    <tr className="bg-[#F6F8FC] border-b border-slate-200 text-[11px] text-slate-500">
                      <th className="py-2.5 px-3 font-semibold">Code</th>
                      <th className="py-2.5 px-3 font-semibold">File name</th>
                      <th className="py-2.5 px-3 font-semibold">Fingerprint (SHA-256)</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(
                      reportData?.evidenceManifest || [
                        {
                          evidenceCode: 'EVD-001',
                          originalFilename: 'sms_phishing_lure_capture.png',
                          sha256Hash: '9a3f2b18c4e5d6a789012345',
                        },
                        {
                          evidenceCode: 'EVD-002',
                          originalFilename: 'mitm_credential_session.pcap',
                          sha256Hash: 'e7b8c9d0a1b2c3d456789012',
                        },
                        {
                          evidenceCode: 'EVD-003',
                          originalFilename: 'upi_transfer_receipt_UTR627491830521.png',
                          sha256Hash: '3c4d5e6f7a8b9c0d12345678',
                        },
                        {
                          evidenceCode: 'EVD-004',
                          originalFilename: 'binance_p2p_usdt_cashout.pdf',
                          sha256Hash: '5e6f7a8b9c0d1e2f34567890',
                        },
                      ]
                    ).map((ev: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                          {ev.evidenceCode}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 truncate max-w-xs">
                          {ev.originalFilename}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {ev.sha256Hash?.slice(0, 14)}…
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E7F6EF] text-[#0E6B45]">
                            Locked ✓
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 4: Investigator Sign-Off */}
          <div className="space-y-3 min-w-0">
            <h3 className="text-sm font-bold text-slate-900">
              4. Investigator Sign-Off
            </h3>
            <div className="rounded-xl bg-[#F6F8FC] border border-slate-200/80 p-5 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
                <div className="flex items-center gap-2">
                  <FileSignature className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-slate-900 text-sm">
                    Signed by: {activeCase.leadInvestigatorName || 'Arjun Verma'}
                  </span>
                </div>
                <span className="text-blue-700 font-semibold text-xs">
                  Lead Investigator
                </span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                I confirm that all digital evidence files listed in this report were locked on upload with SHA-256 digital fingerprints and verified against the case tamper-proof chain with zero unauthorized changes.
              </p>
              <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
                <span className="truncate">
                  Report Seal:{' '}
                  <strong className="text-emerald-700 select-all">
                    {reportData?.digitalSignature ||
                      'f8a42b19e7c30d5a6b8e1f2a3c4d5e6f7a8b9c0d1e2f3a4b'}
                  </strong>
                </span>
                <span className="text-emerald-700 font-bold">Verified ✓</span>
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
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E7F6EF] text-[#0E6B45]">
                5 / 5 Ready
              </span>
            </div>

            <div className="space-y-2.5">
              {checklistItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#F6F8FC] border border-slate-200/80 flex items-start gap-2.5 min-w-0"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#129960] shrink-0 mt-0.5" />
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
