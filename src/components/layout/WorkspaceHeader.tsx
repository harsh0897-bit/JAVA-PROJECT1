import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  UserCheck,
  LogOut,
  Folder,
  ChevronDown,
  Check,
  Bell,
  Clock,
  Network,
  ArrowUpRight,
} from 'lucide-react';
import {
  ExtractedEntity,
  ForensicCaseSummary,
  TimelineEvent,
  UserProfile,
} from '../../types';
import { InvestigationStageId } from './InvestigationStepper';
import { Popover } from './Popover';
import { BrandLogo } from '../ui/BrandLogo';

export interface WorkspaceHeaderProps {
  onNavigateHome: () => void;
  cases: ForensicCaseSummary[];
  activeCaseId: string;
  onSelectCase: (caseId: string) => void;
  onOpenNewCaseModal: () => void;
  onReanalyzeCase: () => void;
  onResetDemo: () => void;
  onOpenSearchModal: () => void;
  currentUser: UserProfile | null;
  availableUsers: UserProfile[];
  onSwitchInvestigatorRole: (username: string) => void;
  onLogout: () => void;
  sseStatus?: string;
  timeline?: TimelineEvent[];
  entities?: ExtractedEntity[];
  onNavigateStage?: (stage: InvestigationStageId) => void;
  onSelectEntity?: (entityId: string) => void;
}

interface DerivedCaseAlert {
  id: string;
  kind: 'TIMELINE_ANOMALY' | 'CRITICAL_ENTITY';
  title: string;
  meta: string;
  badgeLabel: string;
  stageLabel: string;
  targetStage: InvestigationStageId;
  entityId?: string;
}

const CANONICAL_PERSONAS: UserProfile[] = [
  {
    id: 'usr-lead-01',
    username: 'arjun.verma',
    email: 'arjun.verma@cyberfusionx.gov.in',
    fullName: 'Cmdr. Arjun Verma',
    role: 'LEAD_INVESTIGATOR',
    badgeNumber: 'CFX-IND-001',
    organization: 'Financial Crimes & Digital Forensics Unit',
    mfaEnabled: true,
    createdAt: '2026-09-15T08:00:00Z',
  },
  {
    id: 'usr-analyst-02',
    username: 'priya.nair',
    email: 'priya.nair@cyberfusionx.gov.in',
    fullName: 'Insp. Priya Nair',
    role: 'FORENSIC_ANALYST',
    badgeNumber: 'CFX-IND-014',
    organization: 'CyberFusion X Threat Intelligence Lab',
    mfaEnabled: false,
    createdAt: '2026-09-18T09:30:00Z',
  },
  {
    id: 'usr-auditor-03',
    username: 'rohan.kulkarni',
    email: 'rohan.kulkarni@cyberfusionx.gov.in',
    fullName: 'Rohan Kulkarni',
    role: 'AUDITOR',
    badgeNumber: 'CFX-AUD-088',
    organization: 'Judicial Digital Evidence Verification Board',
    mfaEnabled: false,
    createdAt: '2026-09-20T11:15:00Z',
  },
];

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatCaseLoss(c: ForensicCaseSummary): string {
  const inr = c.lossAmountInr || c.estimatedLossInr;
  if (inr && inr > 0) {
    return inrFormatter.format(inr);
  }
  if (c.estimatedLossUsd && c.estimatedLossUsd > 0) {
    return usdFormatter.format(c.estimatedLossUsd);
  }
  return '₹0';
}

function cleanPersonaDisplayName(fullName?: string): string {
  if (!fullName) return 'Cmdr. Arjun Verma';
  return fullName.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function getPersonaInitials(fullName?: string): string {
  const cleaned = cleanPersonaDisplayName(fullName)
    .replace(/^(Cmdr\.|Insp\.|Dr\.|Capt\.)\s+/i, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (cleaned.slice(0, 2) || 'AV').toUpperCase();
}

function getSeverityBadgeClasses(severity: ForensicCaseSummary['severity']): string {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-rose-500/10 text-rose-700 border-rose-500/25';
    case 'HIGH':
      return 'bg-amber-500/10 text-amber-700 border-amber-500/25';
    case 'MEDIUM':
      return 'bg-blue-500/10 text-blue-700 border-blue-500/25';
    default:
      return 'bg-slate-500/10 text-slate-700 border-slate-500/20';
  }
}

function getRoleBadgeClasses(role: UserProfile['role']): string {
  switch (role) {
    case 'LEAD_INVESTIGATOR':
      return 'bg-blue-500/10 text-blue-700 border-blue-500/25';
    case 'FORENSIC_ANALYST':
      return 'bg-indigo-500/10 text-indigo-700 border-indigo-500/25';
    case 'AUDITOR':
      return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25';
  }
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  onNavigateHome,
  cases,
  activeCaseId,
  onSelectCase,
  onOpenNewCaseModal,
  onReanalyzeCase,
  onResetDemo,
  onOpenSearchModal,
  currentUser,
  availableUsers,
  onSwitchInvestigatorRole,
  onLogout,
  sseStatus = 'Java 21 Virtual Threads & SSE Active',
  timeline = [],
  entities = [],
  onNavigateStage,
  onSelectEntity,
}) => {
  const [openMenu, setOpenMenu] = useState<'case' | 'persona' | 'alerts' | 'avatar' | null>(null);
  const [caseHighlightIdx, setCaseHighlightIdx] = useState<number>(0);
  const [personaHighlightIdx, setPersonaHighlightIdx] = useState<number>(0);
  const [alertsHighlightIdx, setAlertsHighlightIdx] = useState<number>(0);
  const [avatarHighlightIdx, setAvatarHighlightIdx] = useState<number>(0);

  const caseTriggerRef = useRef<HTMLButtonElement>(null);
  const personaTriggerRef = useRef<HTMLButtonElement>(null);
  const alertsTriggerRef = useRef<HTMLButtonElement>(null);
  const avatarTriggerRef = useRef<HTMLButtonElement>(null);

  const caseOptionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const personaOptionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const alertsOptionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const avatarOptionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const personas = useMemo<UserProfile[]>(() => {
    return availableUsers && availableUsers.length > 0
      ? availableUsers
      : CANONICAL_PERSONAS;
  }, [availableUsers]);

  const activeCase = useMemo(
    () => cases.find((c) => c.id === activeCaseId) || cases[0] || null,
    [cases, activeCaseId]
  );

  const activePersona = useMemo(() => {
    if (currentUser) return currentUser;
    return personas[0] || null;
  }, [currentUser, personas]);

  const derivedAlerts = useMemo<DerivedCaseAlert[]>(() => {
    const list: DerivedCaseAlert[] = [];

    for (const ev of timeline) {
      if (ev.anomalyFlag) {
        list.push({
          id: `tl-${ev.id}`,
          kind: 'TIMELINE_ANOMALY',
          title: ev.title,
          meta: ev.anomalyReason || ev.description,
          badgeLabel: 'Timeline warning',
          stageLabel: '04 Correlate',
          targetStage: 'TIMELINE',
        });
      }
    }

    for (const ent of entities) {
      if (ent.riskLevel === 'CRITICAL') {
        list.push({
          id: `ent-${ent.id}`,
          kind: 'CRITICAL_ENTITY',
          title: ent.displayLabel || ent.normalizedValue,
          meta: `${ent.entityType} · ${ent.roleInIncident}`,
          badgeLabel: 'High-risk clue',
          stageLabel: '03 Reconstruct',
          targetStage: 'GRAPH',
          entityId: ent.id,
        });
      }
    }

    return list;
  }, [timeline, entities]);

  useEffect(() => {
    if (openMenu === 'case') {
      const idx = Math.max(
        0,
        cases.findIndex((c) => c.id === activeCaseId)
      );
      setCaseHighlightIdx(idx);
      requestAnimationFrame(() => {
        caseOptionRefs.current[idx]?.focus();
      });
    } else if (openMenu === 'persona') {
      const idx = Math.max(
        0,
        personas.findIndex((u) => u.username === currentUser?.username)
      );
      setPersonaHighlightIdx(idx);
      requestAnimationFrame(() => {
        personaOptionRefs.current[idx]?.focus();
      });
    } else if (openMenu === 'alerts') {
      setAlertsHighlightIdx(0);
      requestAnimationFrame(() => {
        alertsOptionRefs.current[0]?.focus();
      });
    } else if (openMenu === 'avatar') {
      setAvatarHighlightIdx(0);
      requestAnimationFrame(() => {
        avatarOptionRefs.current[0]?.focus();
      });
    }
  }, [openMenu, cases, activeCaseId, personas, currentUser?.username]);

  const closeCasePopover = useCallback((returnFocus = false) => {
    setOpenMenu((prev) => (prev === 'case' ? null : prev));
    if (returnFocus) {
      requestAnimationFrame(() => caseTriggerRef.current?.focus());
    }
  }, []);

  const closePersonaPopover = useCallback((returnFocus = false) => {
    setOpenMenu((prev) => (prev === 'persona' ? null : prev));
    if (returnFocus) {
      requestAnimationFrame(() => personaTriggerRef.current?.focus());
    }
  }, []);

  const closeAlertsPopover = useCallback((returnFocus = false) => {
    setOpenMenu((prev) => (prev === 'alerts' ? null : prev));
    if (returnFocus) {
      requestAnimationFrame(() => alertsTriggerRef.current?.focus());
    }
  }, []);

  const closeAvatarPopover = useCallback((returnFocus = false) => {
    setOpenMenu((prev) => (prev === 'avatar' ? null : prev));
    if (returnFocus) {
      requestAnimationFrame(() => avatarTriggerRef.current?.focus());
    }
  }, []);

  const handleCaseTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpenMenu((prev) => (prev === 'case' ? null : 'case'));
    } else if (e.key === 'Escape' && openMenu === 'case') {
      e.preventDefault();
      closeCasePopover(true);
    }
  };

  const handleCaseListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (cases.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (caseHighlightIdx + 1) % cases.length;
      setCaseHighlightIdx(next);
      caseOptionRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (caseHighlightIdx - 1 + cases.length) % cases.length;
      setCaseHighlightIdx(prev);
      caseOptionRefs.current[prev]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setCaseHighlightIdx(0);
      caseOptionRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = cases.length - 1;
      setCaseHighlightIdx(last);
      caseOptionRefs.current[last]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const chosen = cases[caseHighlightIdx];
      if (chosen) {
        onSelectCase(chosen.id);
        closeCasePopover(true);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeCasePopover(true);
    } else if (e.key === 'Tab') {
      closeCasePopover(false);
    }
  };

  const handlePersonaTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpenMenu((prev) => (prev === 'persona' ? null : 'persona'));
    } else if (e.key === 'Escape' && openMenu === 'persona') {
      e.preventDefault();
      closePersonaPopover(true);
    }
  };

  const handlePersonaListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (personas.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (personaHighlightIdx + 1) % personas.length;
      setPersonaHighlightIdx(next);
      personaOptionRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (personaHighlightIdx - 1 + personas.length) % personas.length;
      setPersonaHighlightIdx(prev);
      personaOptionRefs.current[prev]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setPersonaHighlightIdx(0);
      personaOptionRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = personas.length - 1;
      setPersonaHighlightIdx(last);
      personaOptionRefs.current[last]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const chosen = personas[personaHighlightIdx];
      if (chosen) {
        onSwitchInvestigatorRole(chosen.username);
        closePersonaPopover(true);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePersonaPopover(true);
    } else if (e.key === 'Tab') {
      closePersonaPopover(false);
    }
  };

  const handleAlertsTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpenMenu((prev) => (prev === 'alerts' ? null : 'alerts'));
    } else if (e.key === 'Escape' && openMenu === 'alerts') {
      e.preventDefault();
      closeAlertsPopover(true);
    }
  };

  const handleAlertsListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const count = derivedAlerts.length;
    if (count === 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAlertsPopover(true);
      } else if (e.key === 'Tab') {
        closeAlertsPopover(false);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (alertsHighlightIdx + 1) % count;
      setAlertsHighlightIdx(next);
      alertsOptionRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (alertsHighlightIdx - 1 + count) % count;
      setAlertsHighlightIdx(prev);
      alertsOptionRefs.current[prev]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setAlertsHighlightIdx(0);
      alertsOptionRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      setAlertsHighlightIdx(count - 1);
      alertsOptionRefs.current[count - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeAlertsPopover(true);
    } else if (e.key === 'Tab') {
      closeAlertsPopover(false);
    }
  };

  const handleAvatarTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpenMenu((prev) => (prev === 'avatar' ? null : 'avatar'));
    } else if (e.key === 'Escape' && openMenu === 'avatar') {
      e.preventDefault();
      closeAvatarPopover(true);
    }
  };

  const handleAvatarListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const count = 3;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (avatarHighlightIdx + 1) % count;
      setAvatarHighlightIdx(next);
      avatarOptionRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (avatarHighlightIdx - 1 + count) % count;
      setAvatarHighlightIdx(prev);
      avatarOptionRefs.current[prev]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setAvatarHighlightIdx(0);
      avatarOptionRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      setAvatarHighlightIdx(count - 1);
      avatarOptionRefs.current[count - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeAvatarPopover(true);
    } else if (e.key === 'Tab') {
      closeAvatarPopover(false);
    }
  };

  const isCaseOpen = openMenu === 'case';
  const isPersonaOpen = openMenu === 'persona';
  const isAlertsOpen = openMenu === 'alerts';
  const isAvatarOpen = openMenu === 'avatar';

  const focusRingClass =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2';

  const personaNameClean = cleanPersonaDisplayName(activePersona?.fullName);
  const personaInitials = getPersonaInitials(activePersona?.fullName);

  return (
    <>
      <style>{`
        @container shell (max-width:1320px){
          .cf-new-case-btn{width:48px!important;padding-left:0!important;padding-right:0!important}
        }
      `}</style>

      <div
        data-shell-row="1"
        className="flex items-center gap-3 h-[var(--row1,64px)] text-slate-900 select-none min-w-0"
      >
        {/* 1. Brand (shrink-0) */}
        <button
          type="button"
          onClick={onNavigateHome}
          title="Return to Public Overview"
          aria-label="CyberFusion X — Return to Public Overview"
          className={`flex items-center gap-2 text-left min-w-0 shrink-0 cursor-pointer group rounded-2xl px-1 py-0.5 transition-transform duration-150 active:scale-[0.985] ${focusRingClass}`}
        >
          <BrandLogo variant="workspace" />
        </button>

        {/* 2. Divider */}
        <div
          aria-hidden="true"
          className="h-8 w-px bg-slate-300/60 border-r border-white/90 shrink-0 min-w-0 cf-hide-xs"
        />

        {/* 3. Case selector (Case ID only, no case title in the shell) */}
        <button
          ref={caseTriggerRef}
          type="button"
          onClick={() => setOpenMenu((prev) => (prev === 'case' ? null : 'case'))}
          onKeyDown={handleCaseTriggerKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isCaseOpen}
          aria-controls="workspace-case-listbox"
          aria-label={
            activeCase
              ? `Switch forensic case, current case ${activeCase.caseNumber}`
              : 'Select forensic case'
          }
          title={activeCase ? activeCase.caseNumber : 'Select Case'}
          style={{
            flex: '1 1 240px',
            minWidth: '185px',
            maxWidth: '300px',
            height: 'min(56px, var(--row1, 64px))',
          }}
          className={`cf-droplet-idle pl-1.5 pr-2.5 flex items-center gap-2.5 min-w-0 cursor-pointer text-left ${focusRingClass}`}
        >
          <span className="cf-bubble text-[#2563EB]">
            <Folder className="w-5 h-5" />
          </span>

          <span className="flex flex-col min-w-0 flex-1 leading-tight">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="text-[12px] font-medium text-slate-500 whitespace-nowrap">
                Active case
              </span>
              {activeCase?.isGoldenHour && (
                <span className="text-[9px] font-bold px-1 rounded bg-rose-100 text-rose-700 border border-rose-200">
                  ⚡ 1930
                </span>
              )}
            </span>
            <span className="text-[14px] font-mono font-semibold text-slate-900 truncate tabular-nums mt-0.5">
              {activeCase?.caseNumber || 'CASE-2026-0841'}
            </span>
          </span>

          <span
            aria-hidden="true"
            className="w-8 h-8 rounded-full bg-white/85 border border-slate-200/80 flex items-center justify-center shrink-0 text-slate-600"
          >
            <ChevronDown
              style={{
                transform: isCaseOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 320ms var(--ease-out)',
              }}
              className="w-4 h-4"
            />
          </span>
        </button>

        {/* 4. New Case (.cf-btn-blue 48px tall, px-5, shrink-0) */}
        <button
          type="button"
          onClick={onOpenNewCaseModal}
          aria-label="Create New Case"
          title="Create New Forensic Case"
          className={`cf-btn-blue cf-new-case-btn h-12 px-5 shrink-0 min-w-0 inline-flex items-center justify-center gap-2 text-sm cursor-pointer ${focusRingClass}`}
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="cf-hide-md whitespace-nowrap">New Case</span>
        </button>

        {/* 5. Divider */}
        <div
          aria-hidden="true"
          className="h-8 w-px bg-slate-300/60 shrink-0 min-w-0 cf-hide-sm"
        />

        {/* 6. Persona selector */}
        <button
          ref={personaTriggerRef}
          type="button"
          onClick={() => setOpenMenu((prev) => (prev === 'persona' ? null : 'persona'))}
          onKeyDown={handlePersonaTriggerKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isPersonaOpen}
          aria-controls="workspace-persona-listbox"
          aria-label={
            activePersona
              ? `Switch investigator persona, current ${personaNameClean}`
              : 'Switch investigator persona'
          }
          title={
            activePersona
              ? `${personaNameClean} · ${activePersona.role.replace(/_/g, ' ')}`
              : 'Switch Investigator'
          }
          style={{
            flex: '1 1 250px',
            minWidth: '180px',
            maxWidth: '310px',
            height: 'min(56px, var(--row1, 64px))',
          }}
          className={`cf-droplet-idle pl-1.5 pr-2.5 flex items-center gap-2.5 min-w-0 cursor-pointer text-left ${focusRingClass}`}
        >
          <span className="cf-bubble text-[#2563EB]">
            <UserCheck className="w-5 h-5" />
          </span>

          <span className="flex flex-col min-w-0 flex-1 leading-tight">
            <span className="text-[12px] font-medium text-slate-500 whitespace-nowrap">
              Investigator
            </span>
            <span className="text-[14px] font-semibold text-slate-900 truncate mt-0.5">
              {personaNameClean}
            </span>
          </span>

          <span
            aria-hidden="true"
            className="w-8 h-8 rounded-full bg-white/85 border border-slate-200/80 flex items-center justify-center shrink-0 text-slate-600"
          >
            <ChevronDown
              style={{
                transform: isPersonaOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 320ms var(--ease-out)',
              }}
              className="w-4 h-4"
            />
          </span>
        </button>

        {/* 7. Spacer (flex:1 1 0) */}
        <div aria-hidden="true" className="flex-[1_1_0%] min-w-0" />

        {/* 8. Tools (shrink-0 flex gap-2.5) */}
        <div className="shrink-0 min-w-0 flex items-center gap-2.5">
          {/* Search clues (48px circle) */}
          <button
            type="button"
            onClick={onOpenSearchModal}
            aria-label="Search clues"
            title="Search clues (⌘K)"
            className={`cf-droplet-idle w-12 h-12 flex items-center justify-center shrink-0 text-slate-700 hover:text-[#1D4ED8] cursor-pointer ${focusRingClass}`}
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Alerts bell (48px circle) */}
          <button
            ref={alertsTriggerRef}
            type="button"
            onClick={() => setOpenMenu((prev) => (prev === 'alerts' ? null : 'alerts'))}
            onKeyDown={handleAlertsTriggerKeyDown}
            aria-haspopup="menu"
            aria-expanded={isAlertsOpen}
            aria-controls="workspace-alerts-menu"
            aria-label={`Case alerts (${derivedAlerts.length})`}
            title={`Case alerts (${derivedAlerts.length})`}
            className={`cf-droplet-idle w-12 h-12 flex items-center justify-center shrink-0 text-slate-700 hover:text-[#1D4ED8] cursor-pointer ${focusRingClass}`}
          >
            <Bell className="w-5 h-5" />
            {derivedAlerts.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1.5 rounded-full bg-[#DC2626] text-white border-2 border-white text-[12px] font-mono font-bold tabular-nums flex items-center justify-center">
                {derivedAlerts.length}
              </span>
            )}
          </button>

          {/* 1px divider */}
          <div aria-hidden="true" className="h-8 w-px bg-slate-300/60 border-r border-white/90 shrink-0" />

          {/* Avatar (48px circle with persona initials, light/blue surface, no dark navy or glow) */}
          <button
            ref={avatarTriggerRef}
            type="button"
            onClick={() => setOpenMenu((prev) => (prev === 'avatar' ? null : 'avatar'))}
            onKeyDown={handleAvatarTriggerKeyDown}
            aria-haspopup="menu"
            aria-expanded={isAvatarOpen}
            aria-controls="workspace-avatar-menu"
            aria-label={`Account menu for ${personaNameClean}`}
            title={`${personaNameClean} · Account & Workspace Actions`}
            className={`inline-flex items-center gap-1.5 rounded-full p-0.5 shrink-0 cursor-pointer ${focusRingClass}`}
          >
            <span className="w-11 h-11 rounded-full bg-[#EAF1FF] border border-blue-200 text-[#1D4ED8] font-bold text-sm tracking-tight flex items-center justify-center shrink-0">
              {personaInitials}
            </span>

            <span
              aria-hidden="true"
              className="w-8 h-8 rounded-full bg-white/90 border border-slate-200/80 flex items-center justify-center shrink-0 text-slate-600"
            >
              <ChevronDown
                style={{
                  transform: isAvatarOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 320ms var(--ease-out)',
                }}
                className="w-4 h-4"
              />
            </span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          POPOVER 1: CASE SELECTOR (width 440px, max 2 lines per row)
          ========================================================================= */}
      <Popover
        id="workspace-case-listbox"
        isOpen={isCaseOpen}
        onClose={closeCasePopover}
        triggerRef={caseTriggerRef}
        width={440}
        role="listbox"
        ariaLabel="Investigation Cases"
        onKeyDown={handleCaseListKeyDown}
      >
        <div className="px-3 py-1.5 text-[13px] font-semibold text-slate-600 flex items-center justify-between">
          <span>Investigation cases ({cases.length})</span>
          <span>Estimated loss</span>
        </div>

        <div className="space-y-1">
          {cases.map((c, idx) => {
            const isSelected = c.id === activeCaseId;
            return (
              <button
                key={c.id}
                ref={(el) => {
                  caseOptionRefs.current[idx] = el;
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setCaseHighlightIdx(idx)}
                onClick={() => {
                  onSelectCase(c.id);
                  closeCasePopover(true);
                }}
                className={`cf-pop-row w-full text-left grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 p-3 cursor-pointer ${focusRingClass}`}
              >
                <div className="w-10 h-10 rounded-full bg-[#EAF1FF] border border-blue-200 flex items-center justify-center shrink-0 text-[#2563EB] self-center">
                  <Folder className="w-5 h-5" />
                </div>

                <div className="min-w-0 flex flex-col justify-center">
                  {/* Line 1: Case title + case number + badges */}
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="text-[14px] font-semibold text-slate-900 truncate">
                      {c.title}
                    </span>
                    <span className="font-mono text-[12px] text-slate-500 shrink-0 tabular-nums">
                      {c.caseNumber}
                    </span>
                    {c.citizenComplaintId && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0 uppercase tracking-wider">
                        Citizen Intake
                      </span>
                    )}
                    {c.isGoldenHour && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 shrink-0 flex items-center gap-0.5">
                        ⚡ Golden Hour
                      </span>
                    )}
                  </div>
                  {/* Line 2: Victim name + loss + status */}
                  <div className="text-[13px] text-slate-600 truncate mt-0.5 tabular-nums flex items-center gap-1.5 flex-wrap">
                    <span>{c.victimName}</span>
                    <span>·</span>
                    <span className="font-semibold text-slate-800">{formatCaseLoss(c)}</span>
                    <span>·</span>
                    <span className={`px-1.5 py-0.2 rounded text-[11px] font-medium border ${getSeverityBadgeClasses(c.severity)}`}>
                      {c.severity}
                    </span>
                    {c.freezeStatus === 'FREEZE_REQUESTED' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        Lien Requested
                      </span>
                    )}
                  </div>
                </div>

                <div
                  aria-hidden="true"
                  className={`w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 self-center ${
                    isSelected
                      ? 'bg-[#2563EB] text-white'
                      : 'border border-slate-300 bg-white/80 text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      </Popover>

      {/* =========================================================================
          POPOVER 2: PERSONA SELECTOR (width 400px, max 2 lines per row)
          ========================================================================= */}
      <Popover
        id="workspace-persona-listbox"
        isOpen={isPersonaOpen}
        onClose={closePersonaPopover}
        triggerRef={personaTriggerRef}
        width={400}
        role="listbox"
        ariaLabel="Switch Investigator"
        onKeyDown={handlePersonaListKeyDown}
      >
        <div className="px-3 py-1.5 text-[13px] font-semibold text-slate-600 flex items-center justify-between">
          <span>Switch investigator</span>
          <span>Role</span>
        </div>

        <div className="space-y-1">
          {personas.map((u, idx) => {
            const isSelected = u.username === activePersona?.username;
            const cleanName = cleanPersonaDisplayName(u.fullName);
            const initials = getPersonaInitials(u.fullName);

            return (
              <button
                key={u.id || u.username}
                ref={(el) => {
                  personaOptionRefs.current[idx] = el;
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setPersonaHighlightIdx(idx)}
                onClick={() => {
                  onSwitchInvestigatorRole(u.username);
                  closePersonaPopover(true);
                }}
                className={`cf-pop-row w-full text-left grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 p-3 cursor-pointer ${focusRingClass}`}
              >
                <div className="w-10 h-10 rounded-full bg-[#EAF1FF] border border-blue-200 text-[#1D4ED8] font-bold text-xs flex items-center justify-center shrink-0 self-center">
                  {initials}
                </div>

                <div className="min-w-0 flex flex-col justify-center">
                  {/* Line 1 */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[14px] font-semibold text-slate-900 truncate">
                      {cleanName}
                    </span>
                    <span className="font-mono text-[12px] text-slate-500 shrink-0 tabular-nums">
                      {u.badgeNumber}
                    </span>
                  </div>
                  {/* Line 2 */}
                  <div className="text-[13px] text-slate-600 truncate mt-0.5">
                    {u.role.replace(/_/g, ' ')} · {u.organization}
                  </div>
                </div>

                <div
                  aria-hidden="true"
                  className={`w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 self-center ${
                    isSelected
                      ? 'bg-[#2563EB] text-white'
                      : 'border border-slate-300 bg-white/80 text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      </Popover>

      {/* =========================================================================
          POPOVER 3: ALERTS BELL MENU (width 380px, max 2 lines per row)
          ========================================================================= */}
      <Popover
        id="workspace-alerts-menu"
        isOpen={isAlertsOpen}
        onClose={closeAlertsPopover}
        triggerRef={alertsTriggerRef}
        width={380}
        role="menu"
        ariaLabel="Case Alerts"
        onKeyDown={handleAlertsListKeyDown}
      >
        <div className="px-3 py-1.5 text-[13px] font-semibold text-slate-600 flex items-center justify-between">
          <span>Active warnings ({derivedAlerts.length})</span>
          <span className="font-mono text-[12px]">{activeCase?.caseNumber}</span>
        </div>

        {derivedAlerts.length === 0 ? (
          <div className="p-4 text-center text-[13px] text-slate-500">
            No warnings or high-risk clues detected in this case.
          </div>
        ) : (
          <div className="space-y-1">
            {derivedAlerts.map((alert, idx) => {
              const isTimeline = alert.kind === 'TIMELINE_ANOMALY';
              return (
                <button
                  key={alert.id}
                  ref={(el) => {
                    alertsOptionRefs.current[idx] = el;
                  }}
                  type="button"
                  role="menuitem"
                  onMouseEnter={() => setAlertsHighlightIdx(idx)}
                  onClick={() => {
                    if (alert.entityId && onSelectEntity) {
                      onSelectEntity(alert.entityId);
                    }
                    onNavigateStage?.(alert.targetStage);
                    closeAlertsPopover(true);
                  }}
                  className={`cf-pop-row w-full text-left grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 p-3 cursor-pointer ${focusRingClass}`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 self-center border ${
                      isTimeline
                        ? 'bg-amber-50 border-amber-200 text-[#D97706]'
                        : 'bg-red-50 border-red-200 text-[#DC2626]'
                    }`}
                  >
                    {isTimeline ? (
                      <Clock className="w-4 h-4" />
                    ) : (
                      <Network className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0 flex flex-col justify-center">
                    <div className="text-[14px] font-semibold text-slate-900 truncate">
                      {alert.title}
                    </div>
                    <div className="text-[13px] text-slate-600 truncate mt-0.5">
                      {alert.badgeLabel} · {alert.meta}
                    </div>
                  </div>

                  <div
                    aria-hidden="true"
                    className="w-[22px] h-[22px] rounded-full border border-slate-300 bg-white/80 text-slate-600 flex items-center justify-center shrink-0 self-center"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Popover>

      {/* =========================================================================
          POPOVER 4: AVATAR ACCOUNT & WORKSPACE MENU (width 300px, max 2 lines/row)
          ========================================================================= */}
      <Popover
        id="workspace-avatar-menu"
        isOpen={isAvatarOpen}
        onClose={closeAvatarPopover}
        triggerRef={avatarTriggerRef}
        width={300}
        role="menu"
        ariaLabel="Investigator Account and Workspace Actions"
        onKeyDown={handleAvatarListKeyDown}
      >
        {activePersona && (
          <div className="p-3 mb-1.5 rounded-2xl bg-[#EAF1FF]/70 border border-blue-200/70">
            <div className="text-[14px] font-semibold text-slate-900 truncate">
              {personaNameClean}
            </div>
            <div className="text-[13px] text-slate-600 truncate mt-0.5">
              {activePersona.role.replace(/_/g, ' ')} · <span className="font-mono">{activePersona.badgeNumber}</span>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <button
            ref={(el) => {
              avatarOptionRefs.current[0] = el;
            }}
            type="button"
            role="menuitem"
            onMouseEnter={() => setAvatarHighlightIdx(0)}
            onClick={() => {
              closeAvatarPopover(true);
              onReanalyzeCase();
            }}
            className={`cf-pop-row w-full text-left grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 p-3 cursor-pointer ${focusRingClass}`}
          >
            <div className="w-9 h-9 rounded-full bg-[#EAF1FF] border border-blue-200 flex items-center justify-center shrink-0 text-[#2563EB] self-center">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-slate-900 truncate">
                Refresh case data
              </div>
              <div className="text-[13px] text-slate-600 truncate">
                Re-check clues and connections
              </div>
            </div>
            <span className="w-[22px] h-[22px]" aria-hidden="true" />
          </button>

          <button
            ref={(el) => {
              avatarOptionRefs.current[1] = el;
            }}
            type="button"
            role="menuitem"
            onMouseEnter={() => setAvatarHighlightIdx(1)}
            onClick={() => {
              closeAvatarPopover(true);
              onResetDemo();
            }}
            className={`cf-pop-row w-full text-left grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 p-3 cursor-pointer ${focusRingClass}`}
          >
            <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-[#D97706] self-center">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-slate-900 truncate">
                Reset pre-loaded cases
              </div>
              <div className="text-[13px] text-slate-600 truncate">
                Restore original cases and locked records
              </div>
            </div>
            <span className="w-[22px] h-[22px]" aria-hidden="true" />
          </button>

          <button
            ref={(el) => {
              avatarOptionRefs.current[2] = el;
            }}
            type="button"
            role="menuitem"
            onMouseEnter={() => setAvatarHighlightIdx(2)}
            onClick={() => {
              closeAvatarPopover(false);
              onLogout();
            }}
            className={`cf-pop-row w-full text-left grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 p-3 cursor-pointer ${focusRingClass}`}
          >
            <div className="w-9 h-9 rounded-full bg-red-50 border border-red-200 flex items-center justify-center shrink-0 text-[#DC2626] self-center">
              <LogOut className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[#DC2626] truncate">
                Sign out
              </div>
              <div className="text-[13px] text-slate-600 truncate">
                Return to login screen
              </div>
            </div>
            <span className="w-[22px] h-[22px]" aria-hidden="true" />
          </button>
        </div>
      </Popover>
    </>
  );
};

export default WorkspaceHeader;
