import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  UserProfile,
  ForensicCaseSummary,
  EvidenceItem,
  ExtractedEntity,
  EntityRelationship,
  TimelineEvent,
  IntegrityVerification,
  ChainOfCustodyEntry,
  ShortestPathResult,
} from './types';
import { HomeLandingView, WorkspaceTabType } from './components/HomeLandingView';
import { AuthPortalView } from './components/AuthPortalView';
import { ExecutiveDashboardView } from './components/ExecutiveDashboardView';
import { EvidenceVaultView } from './components/EvidenceVaultView';
import { TimelineReconstructionView } from './components/TimelineReconstructionView';
import { IncidentGraphView } from './components/IncidentGraphView';
import { IntegrityLedgerView } from './components/IntegrityLedgerView';
import { ForensicReportView } from './components/ForensicReportView';
import { WorkspaceHeader } from './components/layout/WorkspaceHeader';
import { InvestigationStepper } from './components/layout/InvestigationStepper';
import { Modal } from './components/ui/Modal';
import { CitizenPortalView } from './components/CitizenPortalView';
import { CitizenComplaint } from './types';

export type AppStage = 'HOME' | 'AUTH' | 'WORKSPACE' | 'CITIZEN_PORTAL';
export type TabType = WorkspaceTabType;

export function App() {
  // 4-Stage Sequenced User Flow:
  // 1. HOME (Standalone Project Home Page at start of website)
  // 2. AUTH (Login / Sign Up / Investigator Portal accessible from Home Page)
  // 3. WORKSPACE (Authenticated Sequenced Forensic Investigation Workspace)
  // 4. CITIZEN_PORTAL (Self-Service Citizen Crime Intake & Golden Hour Gateway)
  const [appStage, setAppStage] = useState<AppStage>('HOME');
  const [citizenPortalStep, setCitizenPortalStep] = useState<number>(1);
  const [citizenGoldenHour, setCitizenGoldenHour] = useState<boolean>(false);
  const [authInitialMode, setAuthInitialMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');
  const [pendingCaseId, setPendingCaseId] = useState<string | null>(null);

  // Auth & RBAC State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [jwtToken, setJwtToken] = useState<string>('');
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);

  // Cases & Active Case State
  const [cases, setCases] = useState<ForensicCaseSummary[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string>('case-phantom-upi-01');
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [entities, setEntities] = useState<ExtractedEntity[]>([]);
  const [relationships, setRelationships] = useState<EntityRelationship[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [verifications, setVerifications] = useState<IntegrityVerification[]>([]);
  const [ledger, setLedger] = useState<ChainOfCustodyEntry[]>([]);
  const [chainVerification, setChainVerification] = useState<any | null>(null);

  // Cross-view selection state
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(
    null
  );
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // UI Modals & Notifications
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [sseStatus, setSseStatus] = useState<string>(
    'Java 21 Virtual Threads & SSE Active'
  );

  // Global Cmd+K Search State
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<any | null>(
    null
  );

  // Sticky workspace shell observers (IntersectionObserver for data-scrolled, ResizeObserver for --shell-h)
  const sentinelRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [isShellScrolled, setIsShellScrolled] = useState(false);

  useEffect(() => {
    if (appStage !== 'WORKSPACE' || !isAuthenticated) {
      setIsShellScrolled(false);
      return;
    }

    const sentinelEl = sentinelRef.current;
    const shellEl = shellRef.current;

    let io: IntersectionObserver | null = null;
    if (sentinelEl && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry) {
            setIsShellScrolled(!entry.isIntersecting);
          }
        },
        { threshold: 0 }
      );
      io.observe(sentinelEl);
    }

    let ro: ResizeObserver | null = null;
    if (shellEl && typeof ResizeObserver !== 'undefined') {
      const updateShellHeight = () => {
        const h = Math.round(shellEl.getBoundingClientRect().height);
        if (h > 0) {
          document.documentElement.style.setProperty('--shell-h', `${h}px`);
        }
      };
      updateShellHeight();
      ro = new ResizeObserver(updateShellHeight);
      ro.observe(shellEl);
    }

    return () => {
      io?.disconnect();
      ro?.disconnect();
    };
  }, [appStage, isAuthenticated]);

  // F: Scroll the element that actually owns scrolling to the top of the destination stage (instant, not smooth)
  const prevTabRef = useRef<TabType>(activeTab);
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      prevTabRef.current = activeTab;
      if (appStage === 'WORKSPACE' && isAuthenticated) {
        const panel = document.querySelector('[role="tabpanel"]') as HTMLElement | null;
        let owner: HTMLElement | Window = window;
        let curr = panel?.parentElement;
        while (curr && curr !== document.body && curr !== document.documentElement) {
          const style = window.getComputedStyle(curr);
          const overflowY = style.overflowY;
          if (
            (overflowY === 'auto' || overflowY === 'scroll') &&
            curr.scrollHeight > curr.clientHeight
          ) {
            owner = curr;
            break;
          }
          curr = curr.parentElement;
        }
        if (owner instanceof Window) {
          if (window.scrollY > 0) {
            window.scrollTo({ top: 0, behavior: 'auto' });
          }
        } else {
          owner.scrollTop = 0;
        }
      }
    }
  }, [activeTab, appStage, isAuthenticated]);

  const showToast = useCallback(
    (text: string, type: 'success' | 'error' | 'info' = 'info') => {
      setToastMessage({ text, type });
      setTimeout(() => {
        setToastMessage((prev) => (prev?.text === text ? null : prev));
      }, 4500);
    },
    []
  );

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {};
    if (jwtToken) {
      h['Authorization'] = `Bearer ${jwtToken}`;
    }
    return h;
  }, [jwtToken]);

  const fetchJsonChecked = async (
    url: string,
    headers?: Record<string, string>
  ) => {
    const res = await fetch(url, headers ? { headers } : undefined);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} on ${url}`);
    }
    return res.json();
  };

  const loadCaseWorkspaceData = useCallback(
    async (caseId: string, tokenOverride?: string) => {
      const headers: Record<string, string> = {};
      const tok = tokenOverride ?? jwtToken;
      if (tok) headers['Authorization'] = `Bearer ${tok}`;

      const [casesRes, evRes, entRes, tlRes, verRes, ledRes] =
        await Promise.all([
          fetchJsonChecked('/api/v1/cases', headers),
          fetchJsonChecked(
            `/api/v1/evidence?caseId=${encodeURIComponent(caseId)}`,
            headers
          ),
          fetchJsonChecked(
            `/api/v1/entities?caseId=${encodeURIComponent(caseId)}`,
            headers
          ),
          fetchJsonChecked(
            `/api/v1/timeline?caseId=${encodeURIComponent(caseId)}`,
            headers
          ),
          fetchJsonChecked(
            `/api/v1/integrity/verifications?caseId=${encodeURIComponent(
              caseId
            )}`,
            headers
          ),
          fetchJsonChecked(
            `/api/v1/integrity/ledger?caseId=${encodeURIComponent(caseId)}`,
            headers
          ),
        ]);

      if (casesRes.cases) setCases(casesRes.cases);
      if (evRes.evidence) {
        setEvidenceList(evRes.evidence);
        setSelectedEvidenceId((prev) =>
          prev && evRes.evidence.some((x: EvidenceItem) => x.id === prev)
            ? prev
            : evRes.evidence[0]?.id || null
        );
      }
      if (entRes.entities) {
        setEntities(entRes.entities);
        setSelectedEntityId((prev) =>
          prev && entRes.entities.some((x: ExtractedEntity) => x.id === prev)
            ? prev
            : entRes.entities[0]?.id || null
        );
      }
      if (entRes.relationships) setRelationships(entRes.relationships);
      if (tlRes.timeline) setTimeline(tlRes.timeline);
      if (verRes.verifications) setVerifications(verRes.verifications);
      if (ledRes.ledger) setLedger(ledRes.ledger);
      if (ledRes.chainVerification)
        setChainVerification(ledRes.chainVerification);
    },
    [jwtToken]
  );

  // Initial Bootstrap with Automatic Retry if Backend is Warming Up
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function init(attempt = 1) {
      try {
        const usersRes = await fetchJsonChecked('/api/v1/auth/users');
        if (cancelled) return;
        if (usersRes.users) setAvailableUsers(usersRes.users);

        await loadCaseWorkspaceData('case-phantom-upi-01');
        if (!cancelled) {
          setSseStatus('Java 21 Virtual Threads & SSE Active');
        }
      } catch {
        if (!cancelled && attempt < 30) {
          setSseStatus(
            `Connecting to Java 21 Forensic Engine (Attempt ${attempt})...`
          );
          retryTimer = setTimeout(() => init(attempt + 1), 700);
        }
      }
    }
    init();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [loadCaseWorkspaceData]);

  // Connect to Jakarta Servlet Async SSE stream
  useEffect(() => {
    const es = new EventSource('/api/v1/stream/cases');
    es.addEventListener('progress', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setSseStatus(`${data.stage}: ${data.message} (${data.percent}%)`);
      } catch {
        // ignore
      }
    });
    return () => {
      es.close();
    };
  }, []);

  // Keyboard shortcut Cmd+K / Ctrl+K for global search inside workspace
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (appStage === 'WORKSPACE') {
          setShowSearchModal((v) => !v);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [appStage]);

  useEffect(() => {
    if (!globalSearchQuery.trim()) {
      setGlobalSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/v1/search?q=${encodeURIComponent(globalSearchQuery)}`)
        .then((r) => r.json())
        .then(setGlobalSearchResults);
    }, 180);
    return () => clearTimeout(timer);
  }, [globalSearchQuery]);

  const activeCase =
    cases.find((c) => c.id === activeCaseId) || cases[0] || null;

  const handleAuthenticated = async (user: UserProfile, token: string) => {
    setCurrentUser(user);
    setJwtToken(token);
    setIsAuthenticated(true);
    setAppStage('WORKSPACE');
    setActiveTab('OVERVIEW');
    const targetCaseId = pendingCaseId || activeCaseId;
    setActiveCaseId(targetCaseId);
    setPendingCaseId(null);
    showToast(
      `Authenticated as ${user.fullName} [${user.role}] — Forensic Workspace Unlocked`,
      'success'
    );
    const usersRes = await fetch('/api/v1/auth/users').then((r) =>
      r.ok ? r.json() : null
    );
    if (usersRes?.users) setAvailableUsers(usersRes.users);
    await loadCaseWorkspaceData(targetCaseId, token);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: authHeaders(),
      });
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setCurrentUser(null);
    setJwtToken('');
    setPendingCaseId(null);
    setActiveTab('OVERVIEW');
    setAppStage('HOME');
    showToast('Signed out of forensic session.', 'info');
  };

  const handleSwitchCase = async (newId: string) => {
    setActiveCaseId(newId);
    await loadCaseWorkspaceData(newId);
  };

  const handleSwitchInvestigatorRole = async (username: string) => {
    const res = await fetch('/api/v1/auth/switch-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (res.ok && data.user) {
      setCurrentUser(data.user);
      setJwtToken(data.token);
      showToast(
        `Switched Investigator Session to ${data.user.fullName} [${data.user.role}]`,
        'info'
      );
      await loadCaseWorkspaceData(activeCaseId, data.token);
    }
  };

  const handleReanalyzeCase = async () => {
    const res = await fetch(
      `/api/v1/cases/${encodeURIComponent(activeCaseId)}/reanalyze`,
      {
        method: 'POST',
        headers: authHeaders(),
      }
    );
    if (res.ok) {
      await loadCaseWorkspaceData(activeCaseId);
      showToast(
        'Re-ran OCR/NLP, JGraphT PageRank Centrality, and Heuristic Risk Scoring!',
        'success'
      );
    }
  };

  const handleResetDemo = async () => {
    const res = await fetch('/api/v1/cases/reset-demo', {
      method: 'POST',
      headers: authHeaders(),
    });
    if (res.ok) {
      setActiveCaseId('case-phantom-upi-01');
      await loadCaseWorkspaceData('case-phantom-upi-01');
      showToast(
        'Workspace Reset: Restored pre-loaded cases, WORM vault binaries, and entity graph!',
        'success'
      );
    }
  };

  const handleBankFreeze = async (caseId: string) => {
    try {
      const res = await fetch(`/api/v1/cases/${encodeURIComponent(caseId)}/freeze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to broadcast bank freeze', 'error');
        return;
      }
      await loadCaseWorkspaceData(caseId);
      showToast(
        `Emergency 1930 CFCFRMS Freeze Broadcasted! Beneficiary accounts flagged for nodal lien.`,
        'success'
      );
    } catch {
      showToast('Error broadcasting bank freeze command', 'error');
    }
  };

  const handleCitizenComplaintSubmit = async (complaint: CitizenComplaint) => {
    const res = await fetch('/api/v1/citizen/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(complaint),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Could not register citizen complaint', 'error');
      throw new Error(data.error);
    }
    if (data.caseId) {
      setActiveCaseId(data.caseId);
      await loadCaseWorkspaceData(data.caseId);
    } else {
      await loadCaseWorkspaceData(activeCaseId);
    }
    showToast(
      `Citizen Complaint Registered: ${data.complaintId || data.caseNumber} (SHA-256 Sealed)`,
      'success'
    );
    return {
      complaintId: data.complaintId || data.caseNumber,
      caseId: data.caseId,
    };
  };

  const handleUploadFile = async (
    file: File,
    category: string,
    notes: string,
    clientSha256: string
  ) => {
    const form = new FormData();
    form.append('caseId', activeCaseId);
    form.append('category', category);
    form.append('notes', notes);
    form.append('clientSha256', clientSha256);
    form.append('file', file);

    const res = await fetch('/api/v1/evidence/upload', {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'X-Client-SHA256': clientSha256,
      },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Upload failed', 'error');
      return;
    }
    await loadCaseWorkspaceData(activeCaseId);
    if (data.evidence?.id) setSelectedEvidenceId(data.evidence.id);
    showToast(
      `Ingested & Sealed ${data.evidence?.evidenceCode || file.name} (SHA-256 & BLAKE3 Verified)`,
      'success'
    );
  };

  const handleQuickIngest = async (
    title: string,
    category: string,
    content: string
  ) => {
    const res = await fetch('/api/v1/evidence/quick-artifact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        caseId: activeCaseId,
        title,
        category,
        content,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Artifact ingestion failed', 'error');
      return;
    }
    await loadCaseWorkspaceData(activeCaseId);
    if (data.evidence?.id) setSelectedEvidenceId(data.evidence.id);
    showToast(
      `Synthesized & Correlated ${data.evidence?.evidenceCode || title} — Entities & Graph Updated!`,
      'success'
    );
  };

  const handleVerifyIntegrity = async (evidenceId: string) => {
    const res = await fetch('/api/v1/integrity/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ evidenceId }),
    });
    const data = await res.json();
    await loadCaseWorkspaceData(activeCaseId);
    if (data.verification?.status === 'VERIFIED_INTACT') {
      showToast(
        `Integrity Verified INTACT for ${data.verification?.evidenceCode || evidenceId} (SHA-256 & BLAKE3 Match)`,
        'success'
      );
    } else {
      showToast(
        `CRITICAL ALERT: Cryptographic Hash Mismatch Detected on ${data.verification?.evidenceCode || evidenceId}!`,
        'error'
      );
    }
  };

  const handleSimulateTamper = async (evidenceId: string, tamper: boolean) => {
    const res = await fetch('/api/v1/integrity/simulate-tamper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ evidenceId, tamper: String(tamper) }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Tamper simulation failed', 'error');
      return;
    }
    await loadCaseWorkspaceData(activeCaseId);
    if (tamper) {
      showToast(
        `TAMPER_DETECTED: 1-byte storage alteration caused SHA-256 & BLAKE3 mismatch on ${data.verification?.evidenceCode || evidenceId}!`,
        'error'
      );
    } else {
      showToast(
        `Restored WORM Vault Copy for ${data.verification?.evidenceCode || evidenceId} — Integrity VERIFIED_INTACT`,
        'success'
      );
    }
  };

  const handleVerifyAllCaseEvidence = async () => {
    await fetch('/api/v1/integrity/verify-case', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ caseId: activeCaseId }),
    });
    await loadCaseWorkspaceData(activeCaseId);
    showToast(
      'Verified SHA-256 & BLAKE3 digests across all case evidence items',
      'success'
    );
  };

  const handleTraceShortestPath = async (
    sourceId: string,
    targetId: string
  ): Promise<ShortestPathResult | null> => {
    const res = await fetch(
      `/api/v1/graph/shortest-path?caseId=${encodeURIComponent(
        activeCaseId
      )}&sourceId=${encodeURIComponent(sourceId)}&targetId=${encodeURIComponent(
        targetId
      )}`,
      { headers: authHeaders() }
    );
    const data = await res.json();
    if (data.pathFound) {
      showToast(
        `Dijkstra Shortest Path Traced: ${data.hopCount} Hops (Weight ${data.totalWeight})`,
        'info'
      );
    } else {
      showToast(
        'No directed or undirected path connects those two entities.',
        'error'
      );
    }
    return data;
  };

  const handleCreateRelationship = async (
    sourceEntityId: string,
    targetEntityId: string,
    relationshipType: string,
    label: string
  ) => {
    const res = await fetch('/api/v1/entities/relationship', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        caseId: activeCaseId,
        sourceEntityId,
        targetEntityId,
        relationshipType,
        label,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Could not create relationship', 'error');
      return;
    }
    await loadCaseWorkspaceData(activeCaseId);
    showToast(
      `Created directed graph edge [${relationshipType}] & recomputed PageRank`,
      'success'
    );
  };

  const handleMergeEntities = async (
    primaryEntityId: string,
    duplicateEntityId: string
  ) => {
    const res = await fetch('/api/v1/entities/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        caseId: activeCaseId,
        primaryEntityId,
        secondaryEntityId: duplicateEntityId,
        duplicateEntityId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Could not merge entities', 'error');
      return;
    }
    await loadCaseWorkspaceData(activeCaseId);
    showToast(
      `Merged duplicate alias into ${data.mergedEntity?.displayLabel || primaryEntityId}`,
      'success'
    );
  };

  const handleAddTimelineMilestone = async (payload: {
    title: string;
    description: string;
    killChainPhase: string;
    severity: string;
  }) => {
    const res = await fetch('/api/v1/timeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        caseId: activeCaseId,
        ...payload,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Could not add timeline milestone', 'error');
      return;
    }
    await loadCaseWorkspaceData(activeCaseId);
    showToast(`Added Investigator Milestone: ${payload.title}`, 'success');
  };



  // =========================================================================
  // STAGE 1: PUBLIC HOME PAGE (Default entry point at start of website)
  // =========================================================================
  if (appStage === 'HOME') {
    return (
      <>
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-[70] max-w-md bg-cfx-surface-elevated border border-cfx-border rounded-2xl shadow-cfx-elevated p-4 flex items-start gap-3 text-cfx-text-primary">
            {toastMessage.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-cfx-danger shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-cfx-success shrink-0 mt-0.5" />
            )}
            <div className="text-xs font-semibold text-cfx-text-primary leading-relaxed">
              {toastMessage.text}
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-cfx-text-muted hover:text-cfx-text-primary transition"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <HomeLandingView
          activeCase={activeCase}
          cases={cases}
          isAuthenticated={isAuthenticated}
          onSelectCase={(id) => {
            setActiveCaseId(id);
            if (!isAuthenticated) {
              setPendingCaseId(id);
            }
          }}
          onNavigate={(tab) => {
            if (!isAuthenticated || !currentUser) {
              setAuthInitialMode('LOGIN');
              setAppStage('AUTH');
              return;
            }
            setActiveTab(tab);
            setAppStage('WORKSPACE');
          }}
          onOpenAuthPortal={(mode) => {
            setAuthInitialMode(mode);
            setAppStage('AUTH');
          }}
          onRunGlobalVerify={handleVerifyAllCaseEvidence}
          onOpenCitizenPortal={(step = 1, isGolden = false) => {
            setCitizenPortalStep(step);
            setCitizenGoldenHour(isGolden);
            setAppStage('CITIZEN_PORTAL');
          }}
        />
      </>
    );
  }

  // =========================================================================
  // STAGE: CITIZEN EMERGENCY INTAKE PORTAL
  // =========================================================================
  if (appStage === 'CITIZEN_PORTAL') {
    return (
      <CitizenPortalView
        initialStep={citizenPortalStep}
        initialGoldenHour={citizenGoldenHour}
        onBackToHome={() => setAppStage('HOME')}
        onOpenOfficerPortal={() => {
          if (currentUser) {
            setIsAuthenticated(true);
            setAppStage('WORKSPACE');
          } else {
            const defaultOfficer: UserProfile = availableUsers[0] || {
              id: 'usr-lead-01',
              username: 'arjun.verma',
              fullName: 'Cmdr. Arjun Verma',
              email: 'arjun.verma@cyberfusion.mh.gov.in',
              role: 'LEAD_INVESTIGATOR',
              department: 'Maharashtra Cyber Crime Branch — BKC',
              clearanceBadge: 'CFX-MH-COMMANDER-01',
            };
            setCurrentUser(defaultOfficer);
            setIsAuthenticated(true);
            setAppStage('WORKSPACE');
          }
        }}
        onSubmitComplaint={handleCitizenComplaintSubmit}
      />
    );
  }

  // =========================================================================
  // STAGE 2: LOGIN / SIGN UP & DEMO USERS PORTAL
  // =========================================================================
  if (appStage === 'AUTH') {
    return (
      <AuthPortalView
        initialMode={authInitialMode}
        onAuthenticated={handleAuthenticated}
        onBackToHome={() => setAppStage('HOME')}
      />
    );
  }

  // =========================================================================
  // STAGE 3: AUTHENTICATED SEQUENCED FORENSIC WORKSPACE
  // =========================================================================
  // Guard: unauthenticated visits cannot enter the workspace without logging in
  if (!isAuthenticated || !currentUser) {
    return (
      <AuthPortalView
        initialMode="LOGIN"
        onAuthenticated={handleAuthenticated}
        onBackToHome={() => setAppStage('HOME')}
      />
    );
  }
  return (
    <div className="min-h-screen min-h-[100dvh] text-cfx-text-primary flex flex-col font-sans">
      {/* 1px IntersectionObserver sentinel above the sticky glass shell */}
      <div
        ref={sentinelRef}
        aria-hidden="true"
        className="h-px w-full pointer-events-none"
      />

      {/* Single Sticky Glass Shell (Header + Stepper: z-30, below popovers z-40 and modals z-60) */}
      <div
        ref={shellRef}
        data-scrolled={isShellScrolled ? 'true' : 'false'}
        className="sticky top-0 z-30 mx-auto w-full max-w-[1680px] px-3 sm:px-6 pt-2 pb-1"
      >
        <div className="cf-liquid-shell rounded-[32px] p-3 flex flex-col gap-2.5">
          <WorkspaceHeader
            onNavigateHome={() => setAppStage('HOME')}
            cases={cases}
            activeCaseId={activeCaseId}
            onSelectCase={handleSwitchCase}
            onOpenNewCaseModal={() => {
              setCitizenPortalStep(1);
              setCitizenGoldenHour(false);
              setAppStage('CITIZEN_PORTAL');
            }}
            onReanalyzeCase={handleReanalyzeCase}
            onResetDemo={handleResetDemo}
            onOpenSearchModal={() => setShowSearchModal(true)}
            currentUser={currentUser}
            availableUsers={availableUsers}
            onSwitchInvestigatorRole={handleSwitchInvestigatorRole}
            onLogout={handleLogout}
            sseStatus={sseStatus}
            timeline={timeline}
            entities={entities}
            onNavigateStage={(stage) => setActiveTab(stage)}
            onSelectEntity={(id) => setSelectedEntityId(id)}
          />
          <InvestigationStepper
            activeStage={activeTab}
            onSelectStage={(stage) => setActiveTab(stage)}
            evidenceCount={evidenceList.length}
            entityCount={entities.length}
            timelineCount={timeline.length}
          />
        </div>
      </div>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-[70] max-w-md bg-cfx-surface border border-cfx-border rounded-2xl shadow-cfx-elevated p-4 flex items-start gap-3 text-cfx-text-primary">
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-cfx-danger shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-cfx-success shrink-0 mt-0.5" />
          )}
          <div className="text-xs font-semibold text-cfx-text-primary leading-relaxed">
            {toastMessage.text}
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-cfx-text-muted hover:text-cfx-text-primary transition"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Level 3: Current Investigation Stage (Cleanly rendered below shell) */}
      <main className="relative mx-auto w-full max-w-[1680px] px-3 sm:px-6 pt-4 pb-12 flex-1 min-w-0">
        <div
          key={activeTab}
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="stage-enter min-w-0 scroll-mt-[var(--shell-h,148px)]"
        >

        {activeTab === 'OVERVIEW' && activeCase && (
          <ExecutiveDashboardView
            currentUser={currentUser}
            activeCase={activeCase}
            evidenceList={evidenceList}
            entities={entities}
            relationships={relationships}
            timeline={timeline}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onSelectEntityForGraph={(id) => setSelectedEntityId(id)}
            onSelectEvidenceForVault={(id) => setSelectedEvidenceId(id)}
            onBroadcastFreeze={handleBankFreeze}
          />
        )}

        {activeTab === 'EVIDENCE' && (
          <EvidenceVaultView
            caseId={activeCaseId}
            evidenceList={evidenceList}
            entities={entities}
            ledger={ledger}
            selectedEvidenceId={selectedEvidenceId}
            onSelectEvidence={(id) => setSelectedEvidenceId(id)}
            onUploadFile={handleUploadFile}
            onQuickIngest={handleQuickIngest}
            onVerifyIntegrity={handleVerifyIntegrity}
            onSimulateTamper={handleSimulateTamper}
            userRole={currentUser?.role || 'LEAD_INVESTIGATOR'}
          />
        )}

        {activeTab === 'GRAPH' && (
          <IncidentGraphView
            activeCase={activeCase || undefined}
            evidenceList={evidenceList}
            entities={entities}
            relationships={relationships}
            selectedEntityId={selectedEntityId}
            onSelectEntity={(id) => setSelectedEntityId(id)}
            onTraceShortestPath={handleTraceShortestPath}
            onCreateRelationship={handleCreateRelationship}
            onMergeEntities={handleMergeEntities}
          />
        )}

        {activeTab === 'TIMELINE' && (
          <TimelineReconstructionView
            activeCase={activeCase || undefined}
            timeline={timeline}
            evidenceList={evidenceList}
            entities={entities}
            onSelectEvidence={(evId) => {
              setSelectedEvidenceId(evId);
              setActiveTab('EVIDENCE');
            }}
            onSelectEntity={(entId) => {
              setSelectedEntityId(entId);
              setActiveTab('GRAPH');
            }}
            onAddMilestone={handleAddTimelineMilestone}
          />
        )}

        {activeTab === 'INTEGRITY' && (
          <IntegrityLedgerView
            evidenceList={evidenceList}
            verifications={verifications}
            ledger={ledger}
            chainVerification={chainVerification}
            onVerifySingle={handleVerifyIntegrity}
            onVerifyAllCaseEvidence={handleVerifyAllCaseEvidence}
            onRefreshLedger={() => loadCaseWorkspaceData(activeCaseId)}
          />
        )}

        {activeTab === 'REPORT' && activeCase && (
          <ForensicReportView
            activeCase={activeCase}
            evidenceList={evidenceList}
            entities={entities}
            relationships={relationships}
            timeline={timeline}
            verifications={verifications}
            ledger={ledger}
            chainVerification={chainVerification}
            currentUser={currentUser}
          />
        )}
        </div>
      </main>

      {/* Global Search Modal (Cmd+K) — Portaled via Modal */}
      <Modal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        title="Global Forensic Repository Search"
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4 text-[#202733]">
          <div className="p-3 rounded-xl border border-slate-200/80 flex items-center gap-3 bg-[#F6F8FC]">
            <Search className="w-5 h-5 text-[#2563EB] shrink-0" />
            <input
              type="text"
              autoFocus
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              placeholder="Search across all cases: phone numbers, UPI IDs, SHA-256 hashes, wallets..."
              className="flex-1 text-sm bg-transparent text-[#202733] placeholder-[#8492A6] focus:outline-none font-medium"
            />
          </div>

          <div className="space-y-4">
            {!globalSearchResults ? (
              <div className="text-xs text-[#8492A6] text-center py-6">
                Type any entity name, phone number, wallet, or SHA-256 prefix to search across the entire forensic repository.
              </div>
            ) : (
              <>
                {globalSearchResults.entities?.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#8492A6]">
                      Matching Entities ({globalSearchResults.entities.length})
                    </div>
                    {globalSearchResults.entities.map(
                      (ent: ExtractedEntity) => (
                        <div
                          key={ent.id}
                          onClick={() => {
                            setSelectedEntityId(ent.id);
                            setActiveTab('GRAPH');
                            setShowSearchModal(false);
                          }}
                          className="p-3 rounded-xl bg-white hover:bg-blue-50/70 border border-slate-200/80 cursor-pointer flex items-center justify-between text-xs transition shadow-2xs"
                        >
                          <div>
                            <span className="font-semibold text-[#202733]">
                              {ent.displayLabel}
                            </span>
                            <span className="ml-2 font-mono text-[11px] text-[#8492A6]">
                              ({ent.entityType})
                            </span>
                          </div>
                          <span className="text-[#2563EB] font-semibold">
                            Inspect Graph →
                          </span>
                        </div>
                      )
                    )}
                  </div>
                )}

                {globalSearchResults.evidence?.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#8492A6]">
                      Matching Evidence ({globalSearchResults.evidence.length})
                    </div>
                    {globalSearchResults.evidence.map((ev: EvidenceItem) => (
                      <div
                        key={ev.id}
                        onClick={() => {
                          setSelectedEvidenceId(ev.id);
                          setActiveTab('EVIDENCE');
                          setShowSearchModal(false);
                        }}
                        className="p-3 rounded-xl bg-white hover:bg-blue-50/70 border border-slate-200/80 cursor-pointer flex items-center justify-between text-xs transition shadow-2xs"
                      >
                        <div>
                          <span className="font-mono font-bold text-[#2563EB] mr-2">
                            {ev.evidenceCode}
                          </span>
                          <span className="font-semibold text-[#202733]">
                            {ev.originalFilename}
                          </span>
                        </div>
                        <span className="text-[#2563EB] font-semibold">
                          Open Vault →
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
export default App;
