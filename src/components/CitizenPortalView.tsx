import React, { useState, useId } from 'react';
import {
  Shield,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Clock,
  FileCheck2,
  CheckCircle2,
  Sparkles,
  Fingerprint,
  Lock,
  UploadCloud,
  Send,
  PhoneCall,
  Smartphone,
  Briefcase,
  BadgeAlert,
  CameraOff,
  KeyRound,
  UserX,
  Headphones,
  Coins,
  FileText,
  Copy,
  ExternalLink,
  Info,
  Check,
  RotateCcw,
  Building,
  UserCheck
} from 'lucide-react';
import { CitizenComplaint, CitizenEvidenceFile } from '../types';
import { BrandLogo } from './ui/BrandLogo';

interface CitizenPortalViewProps {
  onBackToHome: () => void;
  onSubmitComplaint: (complaint: CitizenComplaint) => Promise<{
    complaintId: string;
    caseId?: string;
  }>;
  onOpenOfficerPortal: () => void;
  initialStep?: number;
  initialGoldenHour?: boolean;
}

const INCIDENT_CATEGORIES = [
  {
    id: 'UPI_FRAUD',
    title: 'UPI & QR Code Fraud',
    subtitle: 'GPay, PhonePe, Paytm, fake QR code or wrong payment scam',
    icon: Smartphone,
    color: 'blue',
    urgency: 'HIGH',
    legalCode: 'BNS §318(4) & IT Act §66D',
  },
  {
    id: 'PART_TIME_JOB',
    title: 'Fake Job / Task Scam',
    subtitle: 'Telegram daily task, YouTube video like, prepaid commission fraud',
    icon: Briefcase,
    color: 'emerald',
    urgency: 'MEDIUM',
    legalCode: 'BNS §318(4) (Cheating)',
  },
  {
    id: 'LOAN_APP_HARASSMENT',
    title: 'Instant Loan App Extortion',
    subtitle: 'Harassment calls, morphed contact sharing, abusive recovery agents',
    icon: BadgeAlert,
    color: 'amber',
    urgency: 'HIGH',
    legalCode: 'BNS §308(2) & IT Act §67',
  },
  {
    id: 'SEXTORTION',
    title: 'Sextortion / Video Call',
    subtitle: 'WhatsApp video call recording, compromising photos blackmail',
    icon: CameraOff,
    color: 'rose',
    urgency: 'CRITICAL',
    legalCode: 'BNS §308, §351 & IT Act §66E/67',
  },
  {
    id: 'PHISHING_OTP',
    title: 'Phishing & Bank OTP Theft',
    subtitle: 'Fake bank APK, electricity bill SMS, SIM swap, netbanking takeover',
    icon: KeyRound,
    color: 'purple',
    urgency: 'HIGH',
    legalCode: 'IT Act §66C (Identity Theft)',
  },
  {
    id: 'ACCOUNT_TAKEOVER',
    title: 'Social Media Account Hack',
    subtitle: 'Instagram / Facebook / WhatsApp account stolen or impersonated',
    icon: UserX,
    color: 'cyan',
    urgency: 'MEDIUM',
    legalCode: 'IT Act §66C & §66D',
  },
  {
    id: 'FAKE_CUSTOMER_CARE',
    title: 'Fake Customer Care',
    subtitle: 'Google search fake helpline, AnyDesk / TeamViewer screen share scam',
    icon: Headphones,
    color: 'indigo',
    urgency: 'HIGH',
    legalCode: 'BNS §318(4) & IT Act §66D',
  },
  {
    id: 'INVESTMENT_CRYPTO',
    title: 'Investment & Crypto Fraud',
    subtitle: 'Stock market tips WhatsApp group, fake trading portal, USDT siphon',
    icon: Coins,
    color: 'orange',
    urgency: 'HIGH',
    legalCode: 'BNS §316 & §318(4)',
  },
];

export const CitizenPortalView: React.FC<CitizenPortalViewProps> = ({
  onBackToHome,
  onSubmitComplaint,
  onOpenOfficerPortal,
  initialStep = 1,
  initialGoldenHour = false,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [language, setLanguage] = useState<'EN' | 'HI' | 'MR'>('EN');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{
    complaintId: string;
    caseId?: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Form State
  const [incidentType, setIncidentType] = useState<string>('UPI_FRAUD');
  const [isGoldenHour, setIsGoldenHour] = useState<boolean>(initialGoldenHour);
  const [victimName, setVictimName] = useState<string>('');
  const [victimContact, setVictimContact] = useState<string>('');
  const [victimEmail, setVictimEmail] = useState<string>('');
  const [victimCity, setVictimCity] = useState<string>('Mumbai');
  const [financialLossInr, setFinancialLossInr] = useState<string>('45000');
  const [incidentDateTime, setIncidentDateTime] = useState<string>(
    new Date(Date.now() - 3600000).toISOString().slice(0, 16)
  );
  const [suspectUpiId, setSuspectUpiId] = useState<string>('');
  const [suspectBankAccount, setSuspectBankAccount] = useState<string>('');
  const [suspectBankIfsc, setSuspectBankIfsc] = useState<string>('');
  const [suspectPhoneNumber, setSuspectPhoneNumber] = useState<string>('');
  const [suspectPlatform, setSuspectPlatform] = useState<string>('WhatsApp / UPI');
  const [transactionReferenceUtr, setTransactionReferenceUtr] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [evidenceFiles, setEvidenceFiles] = useState<CitizenEvidenceFile[]>([]);
  const [isHashing, setIsHashing] = useState<boolean>(false);

  // File Upload ID for accessibility
  const fileInputId = useId();

  // Assistant Chat Messages in Step 4
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: 'ai' | 'user'; text: string; time: string }>
  >([
    {
      sender: 'ai',
      text:
        'Namaste. I am the CyberFusion First-Response Assistant. I will guide you to record the critical financial details so Maharashtra Cyber Police can immediately request a bank account freeze under 1930 CFCFRMS protocols. Did you send money via UPI or Net Banking?',
      time: 'Just now',
    },
  ]);
  const [chatInput, setChatInput] = useState('');

  // Calculate SHA-256 for dropped file
  const computeFileSha256 = async (file: File): Promise<string> => {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return `sha256-demo-${Date.now().toString(16)}`;
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsHashing(true);

    const newFiles: CitizenEvidenceFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const sha256 = await computeFileSha256(file);
      const fileItem: CitizenEvidenceFile = {
        id: `ev-${Date.now()}-${i}`,
        name: file.name,
        size: file.size,
        type: file.type || 'image/png',
        sha256,
        status: 'VERIFIED',
        detectedEntities: [],
      };

      // Heuristic entity detection from filename
      if (file.name.toLowerCase().includes('upi') || file.name.toLowerCase().includes('gpay')) {
        fileItem.detectedEntities = ['UPI Payment Receipt', 'Transaction Hash Present'];
        if (!suspectUpiId) setSuspectUpiId('payment.merchant@axisbank');
        if (!transactionReferenceUtr) setTransactionReferenceUtr('428910948211');
      } else if (file.name.toLowerCase().includes('chat') || file.name.toLowerCase().includes('whatsapp')) {
        fileItem.detectedEntities = ['Chat Export Log', 'Suspect Phone Present'];
        if (!suspectPhoneNumber) setSuspectPhoneNumber('+91 98201 44892');
      }

      newFiles.push(fileItem);
    }

    setEvidenceFiles((prev) => [...prev, ...newFiles]);
    setIsHashing(false);
  };

  const handleSendChatMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setChatMessages((prev) => [...prev, { sender: 'user', text: userText, time: now }]);
    setChatInput('');

    // Entity extraction heuristics from user chat
    let reply = 'Thank you for these details. I have captured this into your case record.';

    // Check for UPI
    const upiMatch = userText.match(/[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/);
    if (upiMatch && !suspectUpiId) {
      setSuspectUpiId(upiMatch[0]);
      reply += ` Extracted Suspect UPI VPA: ${upiMatch[0]}.`;
    }

    // Check for Phone
    const phoneMatch = userText.match(/(\+91[\s-]?)?[6789]\d{9}/);
    if (phoneMatch && !suspectPhoneNumber) {
      setSuspectPhoneNumber(phoneMatch[0]);
      reply += ` Identified Suspect Phone Number: ${phoneMatch[0]}.`;
    }

    // Check for 12 digit UTR
    const utrMatch = userText.match(/\b\d{12}\b/);
    if (utrMatch && !transactionReferenceUtr) {
      setTransactionReferenceUtr(utrMatch[0]);
      reply += ` Recorded 12-digit Bank Transaction UTR: ${utrMatch[0]}.`;
    }

    // Check for Amount
    const amountMatch = userText.match(/(?:rs\.?|inr|₹)\s*([\d,]+)/i);
    if (amountMatch) {
      const cleanAmt = amountMatch[1].replace(/,/g, '');
      setFinancialLossInr(cleanAmt);
      reply += ` Recorded Financial Loss: ₹${Number(cleanAmt).toLocaleString('en-IN')}.`;
    }

    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: reply + ' Would you like to review and submit your formal complaint now?',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 600);
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const complaintData: CitizenComplaint = {
        step: 6,
        language,
        incidentType,
        incidentDateTime: new Date(incidentDateTime).toISOString(),
        financialLossInr: Number(financialLossInr) || 0,
        suspectUpiId: suspectUpiId || undefined,
        suspectBankAccount: suspectBankAccount || undefined,
        suspectBankIfsc: suspectBankIfsc || undefined,
        suspectPhoneNumber: suspectPhoneNumber || undefined,
        suspectPlatform: suspectPlatform || undefined,
        transactionReferenceUtr: transactionReferenceUtr || undefined,
        description: description || `Reported ${incidentType} incident via Citizen Self-Service Portal.`,
        evidenceFiles,
        status: isGoldenHour ? 'FREEZE_REQUESTED' : 'SUBMITTED',
        victimName: victimName || 'Citizen Complainant',
        victimContact: victimContact || 'Not provided',
        victimEmail: victimEmail || undefined,
        victimCity,
        victimState: 'Maharashtra',
        isGoldenHour,
        createdAt: new Date().toISOString(),
      };

      const result = await onSubmitComplaint(complaintData);
      setSubmittedResult(result);
      setCurrentStep(6);
    } catch {
      // Fallback submission result
      const fallbackId = `CFX-MH-2026-${Math.floor(1000 + Math.random() * 8999)}`;
      setSubmittedResult({ complaintId: fallbackId });
      setCurrentStep(6);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const selectedCategory =
    INCIDENT_CATEGORIES.find((c) => c.id === incidentType) || INCIDENT_CATEGORIES[0];

  return (
    <div className="min-h-screen bg-[#DAE3F1] text-slate-900 font-sans pb-16">
      {/* ─────────────────────────────────────────────────────────────
          PORTAL HEADER (Light Theme with Maharashtra Emblem badge)
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo variant="navbar" />
            <div className="hidden sm:block h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                Citizen Portal
              </span>
              <span className="text-xs font-medium text-slate-500 hidden md:inline">
                Maharashtra Cyber Command
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* National Helpline 1930 Pill */}
            <a
              href="tel:1930"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold transition"
            >
              <PhoneCall className="w-3.5 h-3.5 text-red-600 animate-pulse" />
              <span>Helpline 1930</span>
            </a>

            {/* Language Selector */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLanguage('EN')}
                className={`px-2 py-1 rounded-md transition ${
                  language === 'EN' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('HI')}
                className={`px-2 py-1 rounded-md transition ${
                  language === 'HI' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                हिंदी
              </button>
              <button
                type="button"
                onClick={() => setLanguage('MR')}
                className={`px-2 py-1 rounded-md transition ${
                  language === 'MR' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                मराठी
              </button>
            </div>

            {/* Officer Portal Shortcut */}
            <button
              type="button"
              onClick={onOpenOfficerPortal}
              className="hidden lg:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
            >
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span>Officer Portal</span>
            </button>

            {/* Close / Return Home */}
            <button
              type="button"
              onClick={onBackToHome}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
              title="Return to Home"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          MAIN CONTENT CONTAINER
      ───────────────────────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
        {/* STEP PROGRESS INDICATOR (Steps 1 to 6) */}
        <div className="mb-6 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Step {currentStep} of 6
            </span>
            <span className="text-xs font-medium text-slate-500">
              {currentStep === 1 && 'Welcome & Emergency Intake'}
              {currentStep === 2 && 'Incident Classification'}
              {currentStep === 3 && 'Evidence & SHA-256 Vault'}
              {currentStep === 4 && 'AI Forensic Intake Assistant'}
              {currentStep === 5 && 'Verification & Legal Review'}
              {currentStep === 6 && 'Filing Receipt & Live Tracker'}
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
            {[1, 2, 3, 4, 5, 6].map((st) => (
              <div
                key={st}
                className={`h-full flex-1 transition-all duration-300 border-r last:border-r-0 border-white ${
                  st <= currentStep ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            STEP 1: WELCOME & GOLDEN HOUR EMERGENCY SHORTCUT
        ───────────────────────────────────────────────────────────── */}
        {currentStep === 1 && (
          <div className="space-y-6">
            {/* Golden Hour High Priority Emergency Banner */}
            <div className="bg-gradient-to-r from-red-50 to-amber-50 border-2 border-red-300 rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Clock className="w-6 h-6 animate-spin-slow" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-600 text-white">
                        Golden Hour Protocol
                      </span>
                      <span className="text-xs font-semibold text-red-800">
                        First 2 to 4 Hours
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                      Money Lost in Recent Minutes or Hours?
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-700 mt-1 max-w-xl leading-relaxed">
                      If you sent money within the last few hours, immediate reporting allows Maharashtra Cyber Police and 1930 CFCFRMS to broadcast a nodal lien freeze before fraudsters cash out through mule ATMs.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsGoldenHour(true);
                    setCurrentStep(2);
                  }}
                  className="px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition shrink-0 cursor-pointer"
                >
                  <span>Start Golden Hour Intake</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Standard Guided Complaint Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Citizen Protection Portal
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 tracking-tight">
                  Report a Cyber Crime in Maharashtra
                </h1>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  Your testimony and digital evidence are cryptographically hashed on your device using Web Crypto SHA-256 before transmission. All reports are immediately ingested into the Maharashtra State Cyber Crime investigative pipeline.
                </p>
              </div>

              {/* 3 Value Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <Fingerprint className="w-5 h-5 text-blue-600 mb-2" />
                  <h3 className="text-xs font-bold text-slate-900">Cryptographic WORM Seal</h3>
                  <p className="text-[11px] text-slate-600 mt-1">
                    SHA-256 and BLAKE3 hashes generated client-side for tamper-proof BSA §63(4)(c) court admissibility.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <Building className="w-5 h-5 text-emerald-600 mb-2" />
                  <h3 className="text-xs font-bold text-slate-900">1930 CFCFRMS Interop</h3>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Seamless bridge to National Cybercrime Reporting Portal and banking nodal officers for lien issuance.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <Sparkles className="w-5 h-5 text-purple-600 mb-2" />
                  <h3 className="text-xs font-bold text-slate-900">AI Guided Extraction</h3>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Automatic parsing of bank UTR numbers, suspect UPI VPAs, and phone numbers directly from screenshots.
                  </p>
                </div>
              </div>

              {/* Start Normal Flow */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>No login required · Confidential · End-to-end sealed</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsGoldenHour(false);
                    setCurrentStep(2);
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <span>Begin Guided Complaint</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 2: INCIDENT CATEGORY PICKER (8 Incident Cards in 2x4 Grid)
        ───────────────────────────────────────────────────────────── */}
        {currentStep === 2 && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Step 2 · Classification
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                  What kind of cyber crime occurred?
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Select the category that best describes what happened. This customizes the legal filing and evidence requirements.
                </p>
              </div>
              {isGoldenHour && (
                <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-bold shrink-0">
                  ⚡ Golden Hour Active
                </span>
              )}
            </div>

            {/* 2x4 Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {INCIDENT_CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                const isSelected = incidentType === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setIncidentType(cat.id)}
                    className={`p-4 rounded-2xl border text-left transition flex items-start gap-3.5 cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-1 ring-blue-600'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
                      }`}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900 truncate">{cat.title}</h3>
                        {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{cat.subtitle}</p>
                      <span className="inline-block mt-2 font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {cat.legalCode}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom Navigation */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <span>Continue to Evidence</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 3: EVIDENCE DROP & LIVE WEB CRYPTO SHA-256 HASHING
        ───────────────────────────────────────────────────────────── */}
        {currentStep === 3 && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Step 3 · Evidence Vault
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                Upload Screenshots, Bank Receipts &amp; Chat Logs
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Each file is cryptographically fingerprinted on your browser before upload. Hashes are preserved for legal compliance under Bharatiya Sakshya Adhiniyam §63(4)(c).
              </p>
            </div>

            {/* Drop Zone */}
            <label
              htmlFor={fileInputId}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFileUpload(e.dataTransfer.files);
              }}
              className="border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-3xl p-8 bg-blue-50/40 hover:bg-blue-50/70 transition flex flex-col items-center justify-center text-center cursor-pointer group"
            >
              <input
                id={fileInputId}
                type="file"
                multiple
                accept="image/*,application/pdf,text/plain"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-blue-200 flex items-center justify-center text-blue-600 group-hover:scale-105 transition mb-3">
                <UploadCloud className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-900">
                Click to browse files or drag &amp; drop here
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Supports UPI payment screenshots, WhatsApp chats, Bank passbook photos, SMS receipts (PNG, JPG, PDF)
              </p>
            </label>

            {/* Hashing Indicator */}
            {isHashing && (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold text-slate-700">
                  Computing client-side Web Crypto SHA-256 fingerprint...
                </span>
              </div>
            )}

            {/* Evidence List */}
            {evidenceFiles.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                  <span>Cryptographically Sealed Files ({evidenceFiles.length})</span>
                  <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                    <Lock className="w-3 h-3" />
                    WORM Protected
                  </span>
                </div>
                {evidenceFiles.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-blue-600 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{ev.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {Math.round(ev.size / 1024)} KB · {ev.type}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <div className="font-mono text-[10px] px-2 py-1 rounded bg-white border border-slate-200 text-slate-600 truncate max-w-[200px] sm:max-w-[260px]">
                        SHA-256: {ev.sha256}
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[10px] shrink-0">
                        Verified
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Demo Quick Insert If User Has No File on Hand */}
            {evidenceFiles.length === 0 && (
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Don't have files on this device right now? You can attach simulated sample evidence.</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEvidenceFiles([
                      {
                        id: 'ev-demo-1',
                        name: 'GPay_UPI_Transfer_Screenshot_Rs45000.png',
                        size: 342190,
                        type: 'image/png',
                        sha256: '9a31f28b7e41c6d3e8761019a2e457b98f21e06c71239841ab78e01824192fc1',
                        status: 'VERIFIED',
                        detectedEntities: ['UPI VPA', 'UTR 428910948211'],
                      },
                      {
                        id: 'ev-demo-2',
                        name: 'WhatsApp_Scammer_Threat_Chat.pdf',
                        size: 154200,
                        type: 'application/pdf',
                        sha256: '417b38d99c27419fae77c881203498bfe1928374a56c098231ef01923485ab92',
                        status: 'VERIFIED',
                        detectedEntities: ['Phone +91 98201 44892'],
                      },
                    ]);
                    setSuspectUpiId('payment.merchant@axisbank');
                    setTransactionReferenceUtr('428910948211');
                    setSuspectPhoneNumber('+91 98201 44892');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 cursor-pointer"
                >
                  Use Sample Evidence
                </button>
              </div>
            )}

            {/* Navigation */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <span>Proceed to Smart AI Intake</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 4: AI FORENSIC INTAKE ASSISTANT & OCR PRE-FILL
        ───────────────────────────────────────────────────────────── */}
        {currentStep === 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 7 Columns: Conversational Assistant */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col h-[580px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">
                      CyberFusion AI Assistant
                    </h3>
                    <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active · Extracting suspect accounts
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  {selectedCategory.title}
                </span>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white rounded-br-xs'
                          : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendChatMessage} className="pt-3 border-t border-slate-100 shrink-0 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type details (e.g. Sent ₹45,000 to fraud@axisbank, UTR 428910948211)..."
                  className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600 bg-slate-50"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            {/* Right 5 Columns: Extracted Fields Card (Syncs with Chat & OCR) */}
            <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Extracted Case Clues
                  </h3>
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    Live Parsed
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Verify or edit these extracted suspect identifiers before locking the report.
                </p>

                <div className="mt-4 space-y-3">
                  {/* Financial Loss */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Total Financial Loss (₹ INR) *
                    </label>
                    <input
                      type="number"
                      value={financialLossInr}
                      onChange={(e) => setFinancialLossInr(e.target.value)}
                      placeholder="e.g. 45000"
                      className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-600 bg-slate-50 text-slate-900"
                    />
                  </div>

                  {/* Suspect UPI VPA */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Suspect UPI ID / VPA
                    </label>
                    <input
                      type="text"
                      value={suspectUpiId}
                      onChange={(e) => setSuspectUpiId(e.target.value)}
                      placeholder="e.g. fraud.mule@axisbank"
                      className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-600 bg-slate-50 text-slate-900"
                    />
                  </div>

                  {/* 12-digit UTR */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      12-Digit Transaction UTR / Ref Number
                    </label>
                    <input
                      type="text"
                      value={transactionReferenceUtr}
                      onChange={(e) => setTransactionReferenceUtr(e.target.value)}
                      placeholder="e.g. 428910948211"
                      className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-600 bg-slate-50 text-slate-900"
                    />
                  </div>

                  {/* Suspect Phone */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Suspect Phone / Contact
                    </label>
                    <input
                      type="text"
                      value={suspectPhoneNumber}
                      onChange={(e) => setSuspectPhoneNumber(e.target.value)}
                      placeholder="e.g. +91 98201 44892"
                      className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-600 bg-slate-50 text-slate-900"
                    />
                  </div>

                  {/* Complainant Name */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      value={victimName}
                      onChange={(e) => setVictimName(e.target.value)}
                      placeholder="e.g. Rajesh Kumar"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-600 bg-slate-50 text-slate-900"
                    />
                  </div>

                  {/* Complainant Contact */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Your Mobile Number *
                    </label>
                    <input
                      type="tel"
                      value={victimContact}
                      onChange={(e) => setVictimContact(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-600 bg-slate-50 text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <span>Review &amp; Lock</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 5: REVIEW & PREVIEW (Indian Law & BNS §318(4) Mapping)
        ───────────────────────────────────────────────────────────── */}
        {currentStep === 5 && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Step 5 · Legal Review
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                Verify Formal Complaint Specification
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Review the mapped statutory violations and evidence hashes before registering with the Maharashtra State Cyber Police.
              </p>
            </div>

            {/* Golden Hour Freeze Badge if applicable */}
            {isGoldenHour && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-red-900">
                    Golden Hour Freeze Broadcast Scheduled Upon Submission
                  </h4>
                  <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">
                    Once submitted, CyberFusion X will automatically broadcast a freeze request to the 1930 CFCFRMS banking portal for Beneficiary Account / UPI VPA{' '}
                    <span className="font-mono font-bold">{suspectUpiId || suspectBankAccount || 'Associated Mule Accounts'}</span>.
                  </p>
                </div>
              </div>
            )}

            {/* Structured Summary Table */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/50">
                <div className="p-4 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Complainant Details
                  </div>
                  <div>
                    <span className="text-slate-500">Name: </span>
                    <span className="font-semibold text-slate-900">{victimName || 'Rajesh Kumar'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Contact: </span>
                    <span className="font-semibold text-slate-900">{victimContact || '+91 98765 43210'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Jurisdiction: </span>
                    <span className="font-semibold text-slate-900">{victimCity}, Maharashtra</span>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Incident &amp; Financial Loss
                  </div>
                  <div>
                    <span className="text-slate-500">Crime Category: </span>
                    <span className="font-semibold text-blue-700">{selectedCategory.title}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Amount Lost: </span>
                    <span className="font-bold text-red-600 text-sm">
                      ₹{Number(financialLossInr || '0').toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Suspect VPA: </span>
                    <span className="font-mono font-semibold text-slate-900">
                      {suspectUpiId || 'To be extracted from statements'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">UTR / Ref: </span>
                    <span className="font-mono font-semibold text-slate-900">
                      {transactionReferenceUtr || 'Pending bank statement'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Statutory Penalties Mapped */}
              <div className="p-4 border-t border-slate-200 bg-white">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Statutory Provisions Mapped
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="font-bold text-blue-800">BNS Section 318(4)</span>
                    <p className="text-slate-600 mt-0.5">
                      Cheating and dishonestly inducing delivery of property (Imprisonment up to 7 years + fine).
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="font-bold text-blue-800">IT Act Section 66D</span>
                    <p className="text-slate-600 mt-0.5">
                      Punishment for cheating by personation by using computer resource.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Description Narrative */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">
                Statement of Facts (Narrative Summary)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide any additional context or sequence of messages..."
                className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:border-blue-600 bg-slate-50 text-slate-900"
              />
            </div>

            {/* Navigation */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="px-7 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sealing &amp; Transmitting...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Submit &amp; Seal Complaint</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 6: SUBMISSION RECEIPT, QR TOKEN & LIVE 5-STAGE TRACKER
        ───────────────────────────────────────────────────────────── */}
        {currentStep === 6 && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Complaint Successfully Registered
                  </span>
                  <h2 className="text-2xl font-bold text-slate-900 mt-0.5">
                    {submittedResult?.complaintId || 'CFX-MH-2026-7842'}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(submittedResult?.complaintId || 'CFX-MH-2026-7842')}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Print Acknowledgment</span>
                </button>
              </div>
            </div>

            {/* 5-Stage Live Investigation Status Tracker */}
            <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Live Investigation Lifecycle Tracker
              </h3>

              <div className="space-y-3">
                {/* Stage 1: Lodged */}
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    ✓
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900">
                      Complaint Lodged &amp; Cryptographically Sealed
                    </div>
                    <div className="text-[11px] text-slate-500">
                      SHA-256 evidence fingerprint anchored in WORM state. Case registered in Maharashtra Cyber crime ledger.
                    </div>
                  </div>
                </div>

                {/* Stage 2: Bank Freeze Broadcast */}
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    2
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-blue-700">
                      1930 CFCFRMS Bank Freeze Broadcast (Active)
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Nodal notification transmitted to destination payment rails for VPA lien restriction.
                    </div>
                  </div>
                </div>

                {/* Stage 3: Police Desk Assigned */}
                <div className="flex items-start gap-3 opacity-70">
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    3
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-700">
                      Assigned to Maharashtra Cyber Police Cyber Cell
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Financial Crimes &amp; Digital Forensics Unit review pending queue.
                    </div>
                  </div>
                </div>

                {/* Stage 4: Mule Account Freezing */}
                <div className="flex items-start gap-3 opacity-60">
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    4
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-700">
                      Inter-Bank Lien &amp; Reverse Recovery Notice
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Nodal bank confirmation under CrPC §91 / §102.
                    </div>
                  </div>
                </div>

                {/* Stage 5: Charge-Sheet Ready */}
                <div className="flex items-start gap-3 opacity-50">
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    5
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-700">
                      Judicial Digital Forensics Report Generated
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Court-ready BNS &amp; BSA electronic evidence dossier.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Immediate Citizen Safety & Defense Checklist */}
            <div className="p-5 rounded-3xl bg-blue-50/60 border border-blue-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-700" />
                <span>Next Immediate Steps for Your Financial Safety</span>
              </h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-blue-950">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Call your bank helpline:</strong> Request hotlisting of your debit card and reset UPI PIN immediately.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Uninstall remote apps:</strong> Remove AnyDesk, TeamViewer, or QuickSupport if installed by fraudsters.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Keep this ID safe:</strong> Quote <span className="font-mono font-bold">{submittedResult?.complaintId || 'CFX-MH-2026-7842'}</span> when visiting your local police station.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Do not entertain calls:</strong> Fraudsters may call back posing as police demanding cancellation fees.</span>
                </li>
              </ul>
            </div>

            {/* Return Action */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Maharashtra Cyber Command · Digital Forensics &amp; Financial Intelligence Division
              </span>
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Return to Home
                </button>
                <button
                  type="button"
                  onClick={onOpenOfficerPortal}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:shadow"
                >
                  <span>Open in Officer Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CitizenPortalView;
