import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  Shield,
  ArrowRight,
  ScanSearch,
  Network,
  Clock,
  FileCheck2,
  CheckCircle2,
  Sparkles,
  Fingerprint,
  Layers,
  LogIn,
  Terminal,
  Binary,
  Scale,
  Key,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { ForensicCaseSummary } from '../types';

// Dynamic import for 3D Evidence Prism scene (keeps initial bundle small)
const EvidencePrism3D = lazy(() => import('./landing/EvidencePrism3D'));

const EvidencePrismLoadingFallback = () => (
  <div className="cf-card w-full h-full min-h-[460px] rounded-[20px] p-6 flex flex-col justify-between animate-pulse text-slate-900">
    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
        <span className="text-sm font-semibold text-slate-800">
          Loading 3D evidence preview...
        </span>
      </div>
      <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
        3D Preview
      </span>
    </div>
    <div className="flex flex-col items-center justify-center py-16 bg-[#F6F8FC] rounded-xl my-3">
      <div className="w-16 h-16 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
      <span className="text-xs text-slate-500 mt-4">Preparing interactive crystal...</span>
    </div>
    <div className="h-14 rounded-xl bg-slate-100 border border-slate-200" />
  </div>
);

export type WorkspaceTabType =
  | 'OVERVIEW'
  | 'EVIDENCE'
  | 'GRAPH'
  | 'TIMELINE'
  | 'INTEGRITY'
  | 'REPORT';

interface HomeLandingViewProps {
  activeCase?: ForensicCaseSummary | null;
  cases: ForensicCaseSummary[];
  isAuthenticated?: boolean;
  onSelectCase: (caseId: string) => void;
  onNavigate: (tab: WorkspaceTabType) => void;
  onOpenAuthPortal: (mode: 'LOGIN' | 'SIGNUP') => void;
  onRunGlobalVerify: () => void;
}

const HOME_LINKS = [
  { id: 'workflow', label: 'How it works' },
  { id: 'capabilities', label: 'Key features' },
  { id: 'cases', label: 'Sample cases' },
  { id: 'roles', label: 'Team roles' },
];

export const HomeLandingView: React.FC<HomeLandingViewProps> = ({
  activeCase,
  cases,
  isAuthenticated = false,
  onSelectCase,
  onNavigate,
  onOpenAuthPortal,
  onRunGlobalVerify,
}) => {
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [activeNavSection, setActiveNavSection] = useState<string>('workflow');
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const [moreMenuOpen, setMoreMenuOpen] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Track scroll (>8px) and viewport width for responsive navbar
  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    const onResize = () => {
      setViewportWidth(window.innerWidth);
      if (window.innerWidth >= 900) {
        setMobileMenuOpen(false);
      }
      if (window.innerWidth >= 1100) {
        setMoreMenuOpen(false);
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sectionIds = ['workflow', 'capabilities', 'cases', 'roles'];
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const visibleRatios = new Map<string, number>();

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.id;
          if (entry.isIntersecting) {
            visibleRatios.set(id, entry.intersectionRatio);
          } else {
            visibleRatios.delete(id);
          }
        });

        let bestId: string | null = null;
        let bestRatio = 0;
        visibleRatios.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        });

        if (bestId) {
          setActiveNavSection(bestId);
        }
      },
      {
        rootMargin: '-18% 0px -52% 0px',
        threshold: [0, 0.15, 0.35, 0.6],
      }
    );

    elements.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const handleNavChange = (sectionId: string) => {
    setActiveNavSection(sectionId);
    setMoreMenuOpen(false);
    setMobileMenuOpen(false);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleAuditClick = () => {
    setIsAuditing(true);
    setTimeout(() => {
      onRunGlobalVerify();
      setIsAuditing(false);
    }, 600);
  };

  const handlePrimaryAction = (targetTab: WorkspaceTabType = 'OVERVIEW') => {
    if (isAuthenticated) {
      onNavigate(targetTab);
    } else {
      onOpenAuthPortal('LOGIN');
    }
  };

  const isMobileNav = viewportWidth < 900;
  const isCompactDesktop = viewportWidth >= 900 && viewportWidth < 1100;
  const visibleLinks = isCompactDesktop ? HOME_LINKS.slice(0, 2) : HOME_LINKS;
  const overflowLinks = isCompactDesktop ? HOME_LINKS.slice(2) : [];

  return (
    <div
      className="w-full min-w-0 overflow-x-clip text-cfx-text-primary flex flex-col font-sans selection:bg-blue-100 selection:text-slate-900"
      style={{ paddingTop: '88px' }}
    >
      {/* =========================================================================
          1. FIXED GLASS NAVBAR (Section 5: Fixed at top, generously spaced links)
          ========================================================================= */}
      <header
        data-scrolled={isScrolled ? 'true' : 'false'}
        className="cf-liquid-shell"
        style={{
          position: 'fixed',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          width: 'min(1320px, calc(100vw - 32px))',
          padding: '8px 14px',
          borderRadius: '9999px',
        }}
      >
        <div className="w-full flex items-center justify-between gap-4 min-w-0">
          {/* Left: Brand Identity (flex-shrink: 0) */}
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-[#2563EB] flex items-center justify-center text-white shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold text-base tracking-tight text-slate-900 truncate">
                  CyberFusion <span className="text-[#2563EB]">X</span>
                </span>
                <span className="hidden lg:inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                  Digital forensics lab
                </span>
              </div>
            </div>
          </div>

          {/* Middle: Generously spaced links (margin: 0 auto, gap: clamp(28px, 3.2vw, 48px)) */}
          {!isMobileNav && (
            <nav
              aria-label="Home page sections"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(28px, 3.2vw, 48px)',
                margin: '0 auto',
              }}
            >
              {visibleLinks.map((item) => {
                const isActive = activeNavSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavChange(item.id)}
                    style={{
                      padding: '8px 14px',
                      fontSize: '14px',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}
                    className={`rounded-full transition cursor-pointer ${
                      isActive
                        ? 'bg-[#2563EB] text-white'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}

              {isCompactDesktop && overflowLinks.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMoreMenuOpen((v) => !v)}
                    style={{
                      padding: '8px 14px',
                      fontSize: '14px',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}
                    className="rounded-full text-slate-700 hover:text-slate-900 hover:bg-white/60 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>More</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  {moreMenuOpen && (
                    <div className="cf-popover absolute right-0 mt-2 w-48 p-2 z-50">
                      {overflowLinks.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavChange(item.id)}
                          className={`w-full text-left px-3.5 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
                            activeNavSection === item.id
                              ? 'bg-[#EAF1FF] text-[#1D4ED8]'
                              : 'text-slate-700 hover:bg-white/70'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </nav>
          )}

          {/* Right: Menu button (<900px) + Primary CTA (flex-shrink: 0) */}
          <div className="flex items-center gap-2 shrink-0">
            {isMobileNav && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="cf-droplet-idle px-3.5 py-2 rounded-full text-sm font-medium text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                <span>Menu</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handlePrimaryAction('OVERVIEW')}
              className="cf-btn-blue inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
            >
              <span>Enter workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Glass Sheet (<900px) */}
        {isMobileNav && mobileMenuOpen && (
          <div className="cf-popover mt-3 p-3 flex flex-col gap-1">
            {HOME_LINKS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavChange(item.id)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                  activeNavSection === item.id
                    ? 'bg-[#EAF1FF] text-[#1D4ED8]'
                    : 'text-slate-700 hover:bg-white/70'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main Public Experience Body */}
      <main className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 md:pb-12 space-y-16 flex-1 min-w-0">
        {/* =========================================================================
            2. HERO SECTION (Solid White Card + Light 3D Prism)
            ========================================================================= */}
        <section className="cf-card relative p-6 sm:p-8 lg:py-8 lg:px-10 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Primary Editorial Column (7 Columns) */}
            <div className="lg:col-span-7 space-y-6 min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Digital evidence &amp; case reconstruction</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-[1.15]">
                Turn scattered digital clues into a clear, verifiable case report.
              </h1>

              <p className="text-slate-600 text-base leading-relaxed max-w-xl">
                Financial fraud cases start with scattered files—chat screenshots, bank receipts, pass-through accounts, and overseas transfers. CyberFusion X locks every file so it cannot be changed, finds connected people and accounts, and builds a step-by-step timeline ready for review.
              </p>

              {/* Action Area */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => handlePrimaryAction('OVERVIEW')}
                  className="cf-btn-blue inline-flex items-center justify-center gap-2.5 px-6 py-3 text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
                >
                  <span>Open forensic workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {!isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => onOpenAuthPortal('LOGIN')}
                    className="cf-droplet-idle px-5 py-3 rounded-full text-slate-900 text-sm font-semibold flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
                  >
                    <LogIn className="w-4 h-4 text-blue-600" />
                    <span>Try sample investigator roles</span>
                  </button>
                )}

                <a
                  href="#workflow"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavChange('workflow');
                  }}
                  className="px-3 py-2.5 text-sm font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-1 transition"
                >
                  <span>See how it works</span>
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>

              {/* Plain-Language Summary Strip */}
              <div className="pt-2">
                <div className="rounded-2xl bg-[#F6F8FC] border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-slate-500">
                      File protection
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      Digital fingerprint lock
                    </div>
                    <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Locked – cannot be changed</span>
                    </div>
                  </div>

                  <div className="space-y-1 sm:pl-4">
                    <div className="text-xs font-medium text-slate-500">
                      Automatic clue finding
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      9 types of clues found
                    </div>
                    <div className="text-xs text-blue-700 font-medium flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>Accounts, phones &amp; links</span>
                    </div>
                  </div>

                  <div className="space-y-1 sm:pl-4">
                    <div className="text-xs font-medium text-slate-500">
                      Ready for review
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      Signed case report
                    </div>
                    <div className="text-xs text-amber-700 font-medium flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-amber-600" />
                      <span>Printable PDF &amp; data export</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Side: Light 3D Interactive Evidence Prism Stage (5 Columns) */}
            <div className="lg:col-span-5 min-w-0">
              <div
                id="evidence-prism-stage"
                className="w-full min-h-[460px] overflow-hidden rounded-[20px] relative"
              >
                <Suspense fallback={<EvidencePrismLoadingFallback />}>
                  <EvidencePrism3D onRunGlobalVerify={onRunGlobalVerify} />
                </Suspense>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            3. FOUR-STAGE WORKFLOW (Plain Language)
            ========================================================================= */}
        <section id="workflow" className="scroll-mt-28 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="text-xs font-semibold text-blue-600 mb-1">
                Step-by-step investigation
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                How an investigation moves from raw files to a finished report
              </h2>
            </div>
            <span className="text-xs text-slate-600 font-medium bg-white px-3.5 py-1.5 rounded-full border border-slate-200">
              Simple 4-step workflow
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="cf-card cf-card-hover p-6 flex flex-col justify-between transition">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center">
                    1
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                    <ScanSearch className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-blue-600">
                    Step 1 · Lock files
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    Add &amp; lock evidence files
                  </h3>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Upload screenshots, chat logs, and bank receipts. Each file gets a unique digital fingerprint and is locked so it cannot be changed.
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Evidence storage</span>
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Locked file
                </span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="cf-card cf-card-hover p-6 flex flex-col justify-between transition">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center">
                    2
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-indigo-600">
                    Step 2 · Find clues
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    Spot accounts, phones &amp; links
                  </h3>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Automatically reads text inside images and documents to pull out phone numbers, bank accounts, payment IDs, and web links.
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Automatic reading</span>
                <span className="text-indigo-700 font-semibold bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Highlighted on image
                </span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="cf-card cf-card-hover p-6 flex flex-col justify-between transition">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-9 h-9 rounded-full bg-amber-600 text-white font-bold text-sm flex items-center justify-center">
                    3
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-amber-700">
                    Step 3 · Check timeline
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    Put events in order &amp; spot edits
                  </h3>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Places every message and transfer in time order and checks hidden photo details to warn you if a receipt screenshot was edited.
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Photo details check</span>
                <span className="text-amber-800 font-semibold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  Spots edited photos
                </span>
              </div>
            </div>

            {/* Step 4 */}
            <div className="cf-card cf-card-hover p-6 flex flex-col justify-between transition">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center">
                    4
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-emerald-700">
                    Step 4 · Export report
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    Verify chain &amp; export report
                  </h3>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Confirms the tamper-proof chain is unbroken and creates a clean, printable case report ready for legal or academic review.
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Export format</span>
                <span className="text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Printable PDF
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            4. KEY CAPABILITIES SECTION
            ========================================================================= */}
        <section id="capabilities" className="scroll-mt-28 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <div className="text-xs font-semibold text-blue-600 mb-1">
              Key features
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Clear tools that explain what happened and prove files are authentic
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Capability 1 */}
            <div className="cf-card lg:col-span-7 p-6 sm:p-7 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                      <Binary className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Tamper-proof chain &amp; locked files
                      </h3>
                      <p className="text-xs text-slate-500">
                        Detects if even a single character in a file is changed
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    Tamper-proof chain
                  </span>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Every uploaded file is sealed with a unique digital fingerprint. Each check is linked to the previous step so reviewers can verify nothing was altered after upload.
                </p>

                <div className="rounded-xl bg-[#F6F8FC] text-slate-800 border border-slate-200 p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-600 pb-2 border-b border-slate-200">
                    <span className="font-semibold flex items-center gap-1.5 text-slate-800">
                      <Terminal className="w-3.5 h-3.5 text-blue-600" />
                      <span>File verification record</span>
                    </span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-1 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      All files intact
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="text-slate-700">
                      <span className="text-blue-700 font-semibold">Digital fingerprint:</span> e3b0c442…
                    </div>
                    <div className="text-slate-500 pt-1 border-t border-slate-200 flex items-center justify-between font-sans">
                      <span>Previous step: a7d9e1c4…</span>
                      <span className="text-emerald-700 font-semibold">Locked – cannot be changed</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  One-click verification across all case files
                </span>
                <button
                  onClick={handleAuditClick}
                  disabled={isAuditing}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Fingerprint className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isAuditing ? 'Checking files...' : 'Verify all files'}</span>
                </button>
              </div>
            </div>

            {/* Capability 2 */}
            <div className="cf-card lg:col-span-5 p-6 sm:p-7 flex flex-col justify-between text-slate-900 min-w-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Automatic clue detection
                      </h3>
                      <p className="text-xs text-slate-500">
                        Highlights key accounts and numbers on screenshots
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Auto-detected
                  </span>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Scans screenshots and documents to highlight payment IDs, phone numbers, and wallet addresses right where they appear on the page.
                </p>

                <div className="space-y-2 pt-1 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F6F8FC] border border-slate-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                      <span className="font-mono font-semibold text-slate-800 truncate">apex.verify.settlement@okaxis</span>
                    </div>
                    <span className="text-xs text-blue-700 shrink-0 font-medium">Payment account</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F6F8FC] border border-slate-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0" />
                      <span className="font-mono font-semibold text-slate-800 truncate">+91 98204 11892</span>
                    </div>
                    <span className="text-xs text-amber-700 shrink-0 font-medium">Caller phone</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F6F8FC] border border-slate-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                      <span className="font-mono font-semibold text-slate-800 truncate">TQn9Y2khEs…</span>
                    </div>
                    <span className="text-xs text-emerald-700 shrink-0 font-medium">Crypto wallet</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-4 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                <span>Highlighted directly on evidence images</span>
                <span className="font-semibold text-blue-700">9 clue types</span>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            5. SAMPLE INVESTIGATIONS
            ========================================================================= */}
        <section id="cases" className="scroll-mt-28 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="text-xs font-semibold text-blue-600 mb-1">
                Sample investigations
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Explore pre-loaded case files
              </h2>
              <p className="text-sm text-slate-500 mt-1 max-w-xl">
                Open a complete investigation pre-loaded with locked evidence files, connected accounts, timeline events, and a printable report.
              </p>
            </div>

            <button
              onClick={() => handlePrimaryAction('OVERVIEW')}
              className="cf-btn-secondary px-4 py-2.5 text-sm font-semibold flex items-center gap-2 self-start sm:self-auto cursor-pointer"
            >
              <span>
                {isAuthenticated ? 'Open selected case' : 'Sign in to inspect'}
              </span>
              <ArrowRight className="w-4 h-4 text-blue-600" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {cases.map((c) => {
              const isSelected = activeCase?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onSelectCase(c.id);
                    handlePrimaryAction('OVERVIEW');
                  }}
                  className={`cf-card cf-card-hover p-6 sm:p-7 transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'ring-2 ring-blue-600/30 border-blue-600'
                      : ''
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-600">
                          {c.caseNumber}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          Sample case
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          c.severity === 'CRITICAL'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        Risk {c.riskScore}/100
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                      {c.title}
                    </h3>

                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                      {c.summary}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 text-slate-500">
                      <div>
                        Lead investigator: <strong className="text-slate-900 font-semibold">{c.leadInvestigatorName}</strong>
                      </div>
                      {c.estimatedLossUsd > 0 && (
                        <div className="border-l border-slate-300 pl-3">
                          Amount involved: <strong className="text-red-700 font-semibold">${c.estimatedLossUsd.toLocaleString()}</strong>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 font-semibold text-blue-600">
                      <span>{isAuthenticated ? 'Open case' : 'Inspect case'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* =========================================================================
            6. BOTTOM PERSONA BANNER
            ========================================================================= */}
        <section id="roles" className="scroll-mt-28 cf-card p-7 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600">
              <Key className="w-4 h-4" />
              <span>Three sample team roles</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Ready to explore the investigation workspace?
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Sign in with one click as a Lead Investigator, Forensic Analyst, or Judicial Reviewer to inspect locked evidence, trace connected accounts, and export the final report.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-700">
              <span className="px-3 py-1 rounded-full bg-[#F6F8FC] border border-slate-200">
                Lead Investigator
              </span>
              <span className="px-3 py-1 rounded-full bg-[#F6F8FC] border border-slate-200">
                Forensic Analyst
              </span>
              <span className="px-3 py-1 rounded-full bg-[#F6F8FC] border border-slate-200">
                Judicial Reviewer
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handlePrimaryAction('OVERVIEW')}
              className="cf-btn-blue inline-flex items-center justify-center gap-2 px-6 py-3 text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <span>Enter investigation workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-5 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
        <div className="max-w-[1680px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-slate-900">CyberFusion X</span>
            <span>— Digital Evidence &amp; Case Reconstruction</span>
          </div>
          <div className="text-xs text-slate-400">
            Digital Forensics Lab · Case Review System
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomeLandingView;

