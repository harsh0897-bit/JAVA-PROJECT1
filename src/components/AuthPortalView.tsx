import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Lock,
  UserCheck,
  UserPlus,
  LogIn,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Building2,
  Mail,
  Eye,
  EyeOff,
  Copy,
  ShieldCheck,
  User,
} from 'lucide-react';
import { UserProfile } from '../types';
import { DropletTabs, DropletTabItem } from './ui/DropletTabs';
import { BrandLogo } from './ui/BrandLogo';

export interface DemoUserEntry extends UserProfile {
  demoPassword?: string;
  permissionsSummary?: string;
}

interface AuthPortalViewProps {
  initialMode?: 'LOGIN' | 'SIGNUP';
  onAuthenticated: (user: UserProfile, token: string) => void;
  onBackToHome: () => void;
}

const DEFAULT_DEMO_USERS: DemoUserEntry[] = [
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
    demoPassword: 'Forensics@2026',
    permissionsSummary:
      'Create cases, ingest and seal WORM evidence, run 1-byte tamper sandbox, merge graph entities, and sign PDF/STIX dossiers.',
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
    demoPassword: 'Analyst@2026',
    permissionsSummary:
      'Upload evidence, inspect OCR bounding boxes, correlate timeline kill-chain milestones, compute Dijkstra graph paths, and export reports.',
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
    demoPassword: 'Auditor@2026',
    permissionsSummary:
      'Read-only chain-of-custody inspection, live SHA-256 and BLAKE3 re-verification, Merkle audit validation, and court PDF export.',
  },
];

function sanitizeDemoUser(u: DemoUserEntry): DemoUserEntry {
  return {
    ...u,
    fullName: (u.fullName || '').replace(/\s*\([^)]*\)\s*$/, '').trim(),
    permissionsSummary: (
      u.permissionsSummary ||
      'Authorized forensic investigator session with Chain-of-Custody ledger tracking.'
    )
      .replace(/^[^:]{3,36}:\s*/, '')
      .trim(),
  };
}

export const AuthPortalView: React.FC<AuthPortalViewProps> = ({
  initialMode = 'LOGIN',
  onAuthenticated,
  onBackToHome,
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>(initialMode);
  const [demoUsers, setDemoUsers] = useState<DemoUserEntry[]>(DEFAULT_DEMO_USERS);
  const [totpPreview, setTotpPreview] = useState<string>('482910');

  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [showSignupPassword, setShowSignupPassword] = useState<boolean>(false);

  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');

  const [signupFullName, setSignupFullName] = useState<string>('');
  const [signupUsername, setSignupUsername] = useState<string>('');
  const [signupEmail, setSignupEmail] = useState<string>('');
  const [signupRole, setSignupRole] = useState<
    'LEAD_INVESTIGATOR' | 'FORENSIC_ANALYST' | 'AUDITOR'
  >('FORENSIC_ANALYST');
  const [signupOrg, setSignupOrg] = useState<string>(
    'CyberFusion X Digital Forensics Division'
  );
  const [signupPassword, setSignupPassword] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [activePersonaLoading, setActivePersonaLoading] = useState<string | null>(null);

  const authTabItems = useMemo<DropletTabItem[]>(
    () => [
      { id: 'LOGIN', label: 'Sign In', icon: LogIn },
      { id: 'SIGNUP', label: 'Register', icon: UserPlus },
    ],
    []
  );

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    fetch('/api/v1/auth/demo-users')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.users && Array.isArray(data.users) && data.users.length > 0) {
          setDemoUsers(data.users.map(sanitizeDemoUser));
        }
      })
      .catch(() => {});

    fetch('/api/v1/auth/totp-preview')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.currentTotpCode) {
          setTotpPreview(data.currentTotpCode);
        }
      })
      .catch(() => {});
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedbackMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.user) {
        setErrorMsg(
          data.error || 'Authentication failed. Check your investigator credentials.'
        );
        return;
      }
      onAuthenticated(data.user, data.token);
    } catch {
      setErrorMsg('Unable to reach the Java 21 Authentication Servlet.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOneClickDemoLogin = async (demo: DemoUserEntry) => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    setSubmitting(true);
    setActivePersonaLoading(demo.username);
    try {
      const res = await fetch('/api/v1/auth/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: demo.username }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        onAuthenticated(data.user, data.token);
      } else {
        setErrorMsg(data.error || 'Demo login failed.');
      }
    } catch {
      setErrorMsg('Unable to reach the Java 21 Authentication Servlet.');
    } finally {
      setSubmitting(false);
      setActivePersonaLoading(null);
    }
  };

  const handleFillForm = (demo: DemoUserEntry) => {
    setMode('LOGIN');
    setLoginUsername(demo.username);
    if (demo.demoPassword) {
      setLoginPassword(demo.demoPassword);
    }
    setErrorMsg(null);
    setFeedbackMsg(`Credentials for ${demo.fullName} loaded into the sign-in form.`);
    setTimeout(() => {
      setFeedbackMsg((prev) => (prev?.includes(demo.fullName) ? null : prev));
    }, 4500);
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedbackMsg(null);
    if (!signupUsername.trim() || !signupPassword.trim()) {
      setErrorMsg('Username and password are required to register an account.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: signupFullName.trim() || signupUsername.trim(),
          username: signupUsername.trim(),
          email: signupEmail.trim(),
          role: signupRole,
          organization: signupOrg.trim(),
          password: signupPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.user) {
        setErrorMsg(data.error || 'Registration failed. Username may already exist.');
        return;
      }
      onAuthenticated(data.user, data.token);
    } catch {
      setErrorMsg('Unable to reach the Java 21 Registration Servlet.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses =
    'w-full h-11 rounded-xl bg-white border border-slate-300/70 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition';

  const labelClasses = 'block text-xs font-semibold text-slate-700 mb-1.5';

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center gap-5 p-4 sm:p-6 text-slate-900 font-sans selection:bg-blue-100 selection:text-slate-900">
      {/* =========================================================================
          1. TOP LIQUID-GLASS CAPSULE HEADER (Aligned with 1240px portal layout)
          ========================================================================= */}
      <header className="cf-liquid-shell rounded-full min-h-[60px] px-4 sm:px-6 py-2.5 w-full max-w-[1240px] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onBackToHome}
            className="cf-droplet-idle px-3.5 py-2 text-slate-700 hover:text-[#1D4ED8] text-xs font-semibold flex items-center gap-2 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
            title="Return to Public Overview"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Overview</span>
            <span className="sm:hidden">Overview</span>
          </button>

          <div
            aria-hidden="true"
            className="h-7 w-px bg-slate-300/60 border-r border-white/90 shrink-0 hidden xs:block"
          />

          <BrandLogo variant="auth" badgeText="AUTH GATEWAY" />
        </div>

        <div className="cf-glass-pill px-3 py-1.5 flex items-center gap-2 text-xs font-mono text-slate-700 shrink-0">
          <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="font-semibold hidden lg:inline">
            PBKDF2-HMAC-SHA256 · HS256 JWT · RFC-6238 TOTP
          </span>
          <span className="font-semibold hidden sm:inline lg:hidden">
            PBKDF2 · HS256 JWT
          </span>
          <span className="font-semibold sm:hidden text-[11px] text-emerald-700">
            HS256
          </span>
        </div>
      </header>

      {/* =========================================================================
          2. MAIN 2-COLUMN SOLID CARD PORTAL GRID (max-w-[1240px])
          ========================================================================= */}
      <main className="grid w-full max-w-[1240px] lg:grid-cols-[minmax(380px,460px)_minmax(0,1fr)] gap-6 items-start">
        {/* =====================================================================
            LEFT CARD: SOLID .cf-card FORM PANEL (Natural height, no stretching)
            ===================================================================== */}
        <section className="cf-card rounded-3xl p-6 min-w-0 flex flex-col gap-4">
          <div className="flex flex-col gap-3 min-w-0">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {mode === 'LOGIN' ? 'Investigator Sign In' : 'Register Investigator Account'}
              </h1>
              <p className="text-xs text-slate-500 mt-1 truncate">
                {mode === 'LOGIN'
                  ? 'Authenticate with credentials or launch a 1-click persona on the right.'
                  : 'Create a PBKDF2-HMAC-SHA256 investigator profile on the custody ledger.'}
              </p>
            </div>

            <div className="flex items-center">
              <DropletTabs
                variant="compact"
                idPrefix="auth-mode"
                ariaLabel="Authentication Mode"
                items={authTabItems}
                value={mode}
                onChange={(nextMode) => {
                  setMode(nextMode as 'LOGIN' | 'SIGNUP');
                  setErrorMsg(null);
                  setFeedbackMsg(null);
                }}
              />
            </div>

            {errorMsg && (
              <div className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700 font-semibold min-w-0">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="truncate">{errorMsg}</span>
              </div>
            )}

            {feedbackMsg && (
              <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800 font-semibold min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">{feedbackMsg}</span>
              </div>
            )}
          </div>

          {mode === 'LOGIN' ? (
            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3 min-w-0">
              <div className="min-w-0">
                <label className={labelClasses}>
                  Investigator Username or Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="e.g. arjun.verma"
                    className={`${inputClasses} pl-10 pr-3.5 font-mono font-semibold`}
                  />
                </div>
              </div>

              <div className="min-w-0">
                <label className={labelClasses}>Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password"
                    className={`${inputClasses} pl-10 pr-10 font-mono font-semibold`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded transition cursor-pointer"
                    title={showLoginPassword ? 'Hide password' : 'Show password'}
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  >
                    {showLoginPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Quiet bg-slate-50 TOTP row with mono code chip */}
              <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs min-w-0">
                <div className="flex items-center gap-2 text-slate-700 font-semibold min-w-0">
                  <KeyRound className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="truncate">Live RFC-6238 TOTP</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 font-mono font-bold text-blue-700 text-xs tabular-nums">
                    {totpPreview}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">30s</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="cf-btn-blue w-full h-12 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
              >
                {submitting && !activePersonaLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                    <span>Authenticating Session...</span>
                  </>
                ) : (
                  <>
                    <span>Authenticate &amp; Enter Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignupSubmit} className="flex flex-col gap-3 min-w-0">
              {/* Row 1: Name | Username */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-w-0">
                <div className="min-w-0">
                  <label className={labelClasses}>Full Name &amp; Title</label>
                  <input
                    type="text"
                    required
                    value={signupFullName}
                    onChange={(e) => setSignupFullName(e.target.value)}
                    placeholder="Insp. Meera Deshmukh"
                    className={`${inputClasses} px-3.5`}
                  />
                </div>
                <div className="min-w-0">
                  <label className={labelClasses}>Username</label>
                  <input
                    type="text"
                    required
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value)}
                    placeholder="meera.deshmukh"
                    className={`${inputClasses} px-3.5 font-mono`}
                  />
                </div>
              </div>

              {/* Row 2: Email | Role */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-w-0">
                <div className="min-w-0">
                  <label className={labelClasses}>Official Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="meera@cyberfusionx.gov.in"
                      className={`${inputClasses} pl-9 pr-3`}
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <label className={labelClasses}>RBAC Role</label>
                  <select
                    value={signupRole}
                    onChange={(e) =>
                      setSignupRole(
                        e.target.value as
                          | 'LEAD_INVESTIGATOR'
                          | 'FORENSIC_ANALYST'
                          | 'AUDITOR'
                      )
                    }
                    className={`${inputClasses} px-3 font-semibold`}
                  >
                    <option value="LEAD_INVESTIGATOR">LEAD_INVESTIGATOR</option>
                    <option value="FORENSIC_ANALYST">FORENSIC_ANALYST</option>
                    <option value="AUDITOR">AUDITOR</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Unit | Password */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-w-0">
                <div className="min-w-0">
                  <label className={labelClasses}>Organization / Unit</label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={signupOrg}
                      onChange={(e) => setSignupOrg(e.target.value)}
                      className={`${inputClasses} pl-9 pr-3`}
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <label className={labelClasses}>Account Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      required
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="Strong password"
                      className={`${inputClasses} pl-9 pr-9 font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded transition cursor-pointer"
                      title={showSignupPassword ? 'Hide password' : 'Show password'}
                      aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                    >
                      {showSignupPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="cf-btn-blue w-full h-12 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create Account &amp; Launch Workspace</span>
                  </>
                )}
              </button>
            </form>
          )}
        </section>

        {/* =====================================================================
            RIGHT CARD: SOLID .cf-card PERSONAS PANEL
            ===================================================================== */}
        <section className="cf-card rounded-3xl p-6 min-w-0 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Investigator Profiles
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#1D4ED8] text-[10px] font-mono font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" />
                  <span>RBAC Ready</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Launch any investigator role in 1 click or copy credentials into the Sign In form.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 min-w-0">
            {demoUsers.map((demo, idx) => {
              const isLead = demo.role === 'LEAD_INVESTIGATOR';
              const isAnalyst = demo.role === 'FORENSIC_ANALYST';
              const isLoadingThisPersona = activePersonaLoading === demo.username;

              return (
                <div
                  key={demo.id}
                  className="grid grid-cols-[48px_minmax(0,1fr)] lg:grid-cols-[48px_minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 items-center p-4 rounded-2xl border border-slate-200/70 bg-white cf-card-hover min-w-0"
                >
                  {/* Col 1: 48px avatar circle spanning the rows */}
                  <div
                    className={`w-12 h-12 rounded-full lg:row-span-3 self-start lg:self-center flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs ${
                      isLead
                        ? 'bg-purple-600'
                        : isAnalyst
                        ? 'bg-blue-600'
                        : 'bg-emerald-700'
                    }`}
                  >
                    {idx === 0 ? 'AV' : idx === 1 ? 'PN' : 'RK'}
                  </div>

                  {/* Col 2 Row 1: Name (15px semibold), role pill, badge id (flex-wrap) */}
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <h3 className="text-[15px] font-semibold text-slate-900 truncate">
                      {demo.fullName}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                        isLead
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : isAnalyst
                          ? 'bg-blue-500/10 text-blue-700 border-blue-500/25'
                          : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25'
                      }`}
                    >
                      {demo.role.replace(/_/g, ' ')}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] font-bold text-slate-600 tabular-nums">
                      {demo.badgeNumber}
                    </span>
                  </div>

                  {/* Col 2 Row 2: One description (line-clamp-2, 13px slate-600, no duplicated prefix) */}
                  <p className="col-start-2 line-clamp-2 text-[13px] text-slate-600 leading-snug min-w-0">
                    {demo.permissionsSummary}
                  </p>

                  {/* Col 2 Row 3: Credential chips flex-wrap gap-2: user: ... and pass: ... */}
                  <div className="col-start-2 flex flex-wrap items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 font-mono text-[11px] text-slate-600 break-all">
                      user: <strong className="text-slate-900">{demo.username}</strong>
                    </span>
                    {demo.demoPassword && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 font-mono text-[11px] text-slate-600 break-all">
                        pass: <strong className="text-slate-900">{demo.demoPassword}</strong>
                      </span>
                    )}
                  </div>

                  {/* Col 3: Spans rows at lg (w-[152px] flex-col gap-2); drops under text in a row below lg */}
                  <div className="col-span-2 lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:row-span-3 shrink-0 w-full lg:w-[152px] flex flex-row lg:flex-col gap-2 pt-2 lg:pt-0">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleOneClickDemoLogin(demo)}
                      className="cf-btn-blue h-10 flex-1 lg:flex-none w-full px-3 text-xs flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
                    >
                      {isLoadingThisPersona ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                          <span>Launching...</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>1-Click Login →</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFillForm(demo)}
                      className="cf-droplet-idle h-10 flex-1 lg:flex-none w-full px-3 text-xs font-semibold text-slate-700 hover:text-[#1D4ED8] flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
                      title={`Copy credentials for ${demo.fullName} into the Sign In form`}
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Fill Form</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer line: small text-xs text-slate-500 row inside the right card */}
          <div className="pt-2 border-t border-slate-200/70 flex items-center gap-2 text-xs text-slate-500 min-w-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">
              Every sign-in, role switch, and evidentiary action is recorded in the SHA-256 Merkle Chain-of-Custody Ledger.
            </span>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AuthPortalView;
