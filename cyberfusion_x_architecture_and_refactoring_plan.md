# CyberFusion X — Full Codebase Audit, De-Bloating Strategy & Dual-Portal Architecture Plan

**Project:** CyberFusion X — AI-Powered Digital Forensics & Fraud Reconstruction  
**Target Region & Legal Framework:** Maharashtra, India ([Maharashtra Cyber / MahaCyber](https://mhcyber.gov.in/en/report-complaint), [National Cyber Crime Reporting Portal / 1930 Helpline](https://www.cybercrime.gov.in/home), [I4C CFCFRMS](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2287674&reg=1&lang=1), [Bharatiya Nyaya Sanhita (BNS) 2023 Section 318](https://devgan.in/bns/section/318/), [Information Technology Act 2000 Sections 66C & 66D](https://siddharthgupta.in/blog/cybercrime-laws-india-2026-it-act-bns-digital-evidence-guide), and [Bharatiya Sakshya Adhiniyam (BSA) 2023 Section 63](https://www.livelaw.in/articles/bharatiya-sakshya-adhiniyam-transformed-digital-evidence-552681))  
**Core Tech Stack:** Java 21 LTS (Spring Boot 3 / Jakarta Servlet 6.1), React 18 + TypeScript + Vite + Tailwind CSS + Three.js (`ThreatGlobe`), PostgreSQL / H2 + IndexedDB Demo Fallback

## 1. Executive Audit of the Existing Codebase (`java-project1`)

An end-to-end inspection of your uploaded archive (`20,129` lines of TypeScript/React across 26 frontend source files, `310 KB` of seed data in `demoSeedSnapshot.json`, plus Maven `pom.xml` and `docker-compose.yml` specifications) shows how each existing file maps to your updated Dual-Portal vision (Victim/Citizen Portal + Cyber Police Portal).

### Current Codebase Inventory & Alignment Diagnosis

| File / Module | Lines of Code | Current Responsibility | Aligned Action & Role |
| :--- | ---: | :--- | :--- |
| `src/App.tsx` | 1,064 | Root state container (`HOME` → `AUTH` → `WORKSPACE`), 6-tab router, SSE listener, `Cmd+K` search | **Upgrade to Dual-Portal Router:** Add `CITIZEN_PORTAL` route (`HOME` → `CITIZEN_PORTAL` or `AUTH` → `WORKSPACE`) so citizens can file & track complaints without logging in, and complaints flow directly into the Officer Workspace. |
| `src/components/landing/EvidencePrism3D.tsx` | 1,012 | Three.js / WebGL rotating glass crystal prism on homepage | **REMOVE (Only 3D Component Removed):** Cuts 1,012 lines of decorative crystal shaders from the landing page to free up the Hero stage for the **Urgent Citizen Intake & Golden Hour Express Gateway Card**. |
| `src/components/HomeLandingView.tsx` | 934 | Marketing landing page with 3D Prism in the 5-column Hero stage | **Refactor Hero Stage:** Replace the removed `EvidencePrism3D` with an interactive **Dual-Portal Emergency Card** (`"I've been scammed / hacked / threatened"`, `"Money lost in the last few hours?"` Golden Hour Express shortcut, `English / हिंदी / मराठी` selector, and Officer Portal entry). |
| `src/components/3d/ThreatGlobe.tsx` | 1,773 | Three.js / `d3-geo` 3D Earth globe with hub-and-spoke attack arcs | **KEEP & ALIGN WITH GOLDEN HOUR TRIAGE:** Retained in Officer View 1 (`ExecutiveDashboardView.tsx` left 8 columns) to visualize how local Indian victim outflows (`India` marker) connect to domestic mule accounts and cross-border C2/phishing/USDT cashout infrastructure. |
| `src/components/ExecutiveDashboardView.tsx` | 506 | Stage 1 Overview with 8-col `ThreatGlobe` and 4-col 2×2 KPI grid | **Upgrade Right 4 Columns + Header:** Pair the 8-col `ThreatGlobe` with the **Proactive "Golden Hour" Action Card** (isolated target UPI/Bank account, 12-digit UTR, Golden Hour countdown timer, and **1-Click Automated CFCFRMS Bank Freeze Trigger**). |
| `src/components/NewCaseWizardModal.tsx` | 1,926 | 4-step manual modal where officers type entities, transactions, and edges | **REMOVE / REPLACE WITH CITIZEN AUTO-INGEST:** Cuts 1,926 lines of manual officer form entry. Cases are created automatically when a victim submits the Citizen Portal flow (or when an officer drops a raw evidence file). |
| `src/components/IncidentGraphView.tsx` | 2,472 | Custom SVG force-directed graph, PageRank/Betweenness metrics, manual entity merge, Dijkstra tracer | **KEEP & STREAMLINE:** Retain the visual node-link graph and Dijkstra shortest-path money-trail tracer (`Victim` → `L1 Mule UPI` → `L2 Bank` → `Cashout`), while pruning manual alias-merge and edge-creation forms. |
| `src/components/EvidenceVaultView.tsx` | 1,273 | Drag-and-drop file upload, Web Crypto `SHA-256`, OCR bounding-box viewer, 1-byte tamper simulator | **KEEP & ALIGN:** Retain the OCR bounding-box inspector and SHA-256 fingerprint verification; add [ZXing](https://github.com/zxing/zxing) UPI QR code decoding and auto-classification. |
| `src/components/TimelineReconstructionView.tsx` | 711 | Chronological event cards, kill-chain phases, EXIF vs. OCR timestamp anomaly alerts | **KEEP:** Retain chronological step reconstruction and the `"Photo edited"` EXIF timestamp discrepancy warning badge. |
| `src/components/IntegrityLedgerView.tsx` | 655 | 4-2-1 Merkle tree diagram, SHA-256/BLAKE3 table, chain-of-custody audit log | **CONSOLIDATE:** Fold chain-of-custody and hash verification directly into the Evidence Inspector and Legal Report view (or keep accessible as an audit drawer) so officers have fewer tabs to click through. |
| `src/components/ForensicReportView.tsx` + `src/lib/reportBuilder.ts` | 2,814 | Client-side PDF 1.7 binary generator, STIX 2.1 JSON, Markdown, and CSV export | **KEEP & LOCALIZE TO MAHARASHTRA / INDIA LAW:** Upgrade exports to generate **1930 CFCFRMS Bank Freeze Notices**, **BNS Section 318 / IT Act 66C-66D FIR Summaries**, and **BSA Section 63(4)(c) Certificates**. |
| `src/fallback/installStandaloneDemoFallback.ts` + `demoSeedSnapshot.json` | 1,935+ | Browser `fetch` interceptor backed by `IndexedDB`/`localStorage` simulating `/api/v1/*` | **KEEP & EXTEND:** Add endpoints for Citizen Complaint intake (`POST /api/v1/citizen/complaints`), AI Chat OCR confirmation, and 1-Click Bank Freeze (`POST /api/v1/cases/:id/freeze`), with `₹` (INR) formatting. |

## 2. Keep vs. Remove Decision Matrix (With 3D Globe Retained & Prism Removed)

| Feature / Component | Decision | Exact Alignment Across Both Portals |
| :--- | :--- | :--- |
| **3D Evidence Prism (`EvidencePrism3D.tsx`)** | **REMOVE** | Removed from `HomeLandingView.tsx` (saves 1,012 LOC). Replaced on the landing page with the **Victim Emergency Reporting & Golden Hour Express Card**. |
| **3D Threat Origin Globe (`ThreatGlobe.tsx`)** | **KEEP & ALIGN** | Kept in the Officer Portal's primary dashboard (`ExecutiveDashboardView.tsx`, Left 8 columns). Visualizes the geographic attack topology (e.g., Victim in **Vasai-Virar / Mumbai, India** → Phishing Proxy in **Frankfurt/Amsterdam** → Offshore Crypto Exit in **Singapore/Seychelles**), synchronized with the **Right 4-Column Golden Hour Bank Freeze Card**. |
| **4-Step Manual Case Wizard (`NewCaseWizardModal.tsx`)** | **REMOVE** | Removed (saves 1,926 LOC). Officers no longer manually fill out 4 tabs of entities and edges; the **Citizen Portal AI Intake** populates cases with zero officer typing. |
| **Manual Entity Merge & Manual Graph Edge Modals** | **REMOVE** | Removed from `IncidentGraphView.tsx`. Entity correlation (matching phone numbers, UPI IDs, and UTRs across files) runs automatically on upload. |
| **Web Crypto Client Hashing + Dual SHA-256 / BLAKE3 Verification** | **KEEP & UPGRADE** | Used at upload time in the Citizen Portal (*"We've secured your file — Digital Fingerprint Verified"*) and trusted implicitly by the Officer Portal to enable the **1-Click Automated Bank Freeze Trigger** and **BSA Section 63 Certificate**. |
| **OCR Bounding-Box Inspector + EXIF Tamper Detection** | **KEEP** | Highlights extracted UPI IDs, UTRs, phone numbers, and URLs directly on the victim's screenshots and flags if a screenshot was edited. |
| **Incident Graph & Dijkstra Shortest-Path Tracer** | **KEEP** | Maps the complete relationship network and traces the shortest financial path from the victim's bank account to the scammer's cashout node. |

## 3. Detailed Feature Architecture & End-to-End Workflows

### Portal 1: Victim / Citizen Portal ("File in Under 3 Minutes" — `CitizenPortalView.tsx`)

Built for someone who is panicking, non-technical, and likely on a mobile phone.

1. **Step 1 — Landing Page (`HomeLandingView.tsx` without 3D Prism)**
   - **Language & Accessibility Bar:** Top-right pill selector for **English**, **हिंदी (Hindi)**, and **मराठी (Marathi)**, plus an **A+ Large Text / High-Contrast Accessibility toggle**.
   - **One Primary Panic Button:** Massive, high-contrast button: **"I've been scammed / hacked / threatened"**.
   - **"Money lost in the last few hours?" Urgent Shortcut:** Red pulse card that jumps straight into the **Golden Hour Express Flow** (prioritizing transaction screenshot drop + instant UTR/UPI extraction so the local police station receives a freeze-ready card in under 90 seconds).
2. **Step 2 — Smart Incident Picker (8 Icon Cards)**
   - Clean 2×4 grid of visual cards with plain-language labels:
     1. **UPI / Online Payment Fraud** (GPay, PhonePe, Paytm, QR scan scam, fake refund)
     2. **Fake Job Scam** (Telegram/WhatsApp rating tasks, fake offer letter fees)
     3. **Loan App Harassment** (Instant loan apps, contact list blackmail, morphed photos)
     4. **Sextortion / Video Blackmail** (Trap video call, extortion threats)
     5. **Phishing Link / Fake KYC** (Fake electricity bill, bank PAN update, RTO `.apk` file)
     6. **Social Media / WhatsApp Hack** (Account takeover, impersonating you to friends)
     7. **Fake Customer Care** (Fake helpline number, AnyDesk/TeamViewer remote access)
     8. **Investment / Trading Scam** (Fake WhatsApp stock/crypto VIP groups)
   - Selecting a card locks in the dynamic question template so the user never sees irrelevant fields.
3. **Step 3 — Drag-and-Drop Evidence Dump (Zero Manual Labeling)**
   - Single unified dropzone accepting **screenshots, PDFs, bank receipts, audio recordings, `.apk` files, and pasted text or URLs**.
   - **Live Hash Fingerprint Confirmation:** As each file is added, browser `crypto.subtle.digest('SHA-256', ...)` computes the cryptographic hash and displays a progress bar ending with:  
     `✓ We've secured your file — Tamper-Proof Fingerprint: 3bbc2d16...1384ce1`
   - **Automatic File Classification:** The system automatically tags each file (`UPI Receipt`, `WhatsApp Chat`, `SMS Alert`, `Voice Recording`, `Suspicious Link`) and extracts entities in the background.
4. **Step 4 — AI Conversational Assistant (Micro-Innovation) + Voice Input**
   - Replaces long forms with a friendly chat interface that asks **one question at a time** and includes a **Voice Input Microphone button** (`Web Speech API` supporting `en-IN`, `hi-IN`, `mr-IN`).
   - **OCR Auto-Fill & 1-Tap Confirmation:** Any detail already found in the uploaded screenshots is pre-filled and presented for simple confirmation:
     - *Assistant:* `"We scanned your receipt and found ₹24,500 sent to UPI ID apex.verify.settlement@okaxis (UTR: 428119482011) on 22 Oct at 07:42 AM. Is this correct?"`
     - *User Taps:* `[✓ Yes, that's right]` or `[✎ Edit amount / UPI ID]`
   - Only asks 2 brief follow-up questions tailored to the incident type (e.g., *"Which bank is your own account with?"* and *"Briefly tell us (or tap the mic to speak) how the scammer contacted you."*).
5. **Step 5 — Review & Confirm Screen (With Save-and-Resume Drafts)**
   - Shows a clean visual card of what CyberFusion X understood:
     - **Extracted Suspect Clues:** UPI IDs, Phone Numbers, Bank Accounts, Phishing URLs.
     - **Total Financial Loss:** Formatted in `₹` (INR).
     - **Draft Chronological Timeline:** 3–4 plain-language steps reconstructed from the evidence.
   - Tapping any field lets the user edit it inline. State is continuously saved to `localStorage` so drafts can be resumed anytime.
6. **Step 6 — Submit & Post-Filing Safety Hub**
   - **Instant Receipt & QR Code:** Generates a unique Complaint ID (e.g., `CFX-MH-2026-0941`), a downloadable **Hash-Sealed Evidence Receipt PDF**, and a scannable **QR Code** for mobile status tracking.
   - **"What Happens Next" Visual Tracker:**
     1. `Received & Evidence Hash-Sealed` *(Completed — Instant)*
     2. `AI Triaged & Target Account Isolated` *(Completed — < 1 min)*
     3. `Bank Freeze Request Queued at Police Triage Desk` *(Est. 5–15 mins)*
     4. `Local Cyber Cell Officer Investigation` *(Est. 2–6 hours)*
     5. `Case & Recovery Status Update` *(Live SMS / QR Tracking)*
   - **"Do-This-Now" Interactive Checklist:**
     - `[ ]` Call **1930** National Cyber Crime Helpline immediately (or visit [cybercrime.gov.in](https://www.cybercrime.gov.in/home)).
     - `[ ]` Call your bank to block your Debit/Credit Card and freeze UPI/NetBanking.
     - `[ ]` Change banking/email passwords and enable Two-Factor Authentication (2FA).
     - `[ ]` Uninstall any remote screen-sharing apps (`AnyDesk`, `RustDesk`, `TeamViewer`) or unknown `.apk` files.
     - `[ ]` **Do NOT delete** WhatsApp messages, SMS alerts, call logs, or transaction screenshots.
     - `[ ]` **Warning:** Never pay anyone claiming they can "hack back" or "recover" your lost money—recovery agents on social media/Telegram are secondary scammers.
   - **Personalized Safety Tips (By Scam Type):** Dynamically displays targeted prevention steps (e.g., for *Fake Job Scams*: how to verify corporate domains and never pay "task recharge" fees; for *UPI Scams*: understanding that entering a UPI PIN **always deducts** money and is never required to receive money; plus direct reference to [Maharashtra Cyber (MahaCyber)](https://mhcyber.gov.in/en/report-complaint)).

### Portal 2: Police & Cybersecurity Expert Portal (Aligned with `ThreatGlobe.tsx`)

When a citizen submits a complaint, it immediately appears in the Officer Workspace with zero manual data entry required.

1. **Stage 1 (`ExecutiveDashboardView.tsx`): Proactive "Golden Hour" Action Card + 3D Threat Globe**
   - **Top Bar — Golden Hour Triage Switcher:** Displays active complaints with a live **Golden Hour Urgency Badge** (highlighting complaints filed within the critical first hours where funds are still in the Level-1/Level-2 domestic mule network).
   - **Left 8 Columns — Retained 3D Threat Origin Globe (`ThreatGlobe.tsx`):**
     - Visualizes the geographic correlation of the active case: pins the **Victim & L1 Mule Bank in India (Maharashtra)** and draws hub-and-spoke arcs to any **foreign C2 phishing servers, VPN relays, or offshore USDT cashout exchanges** extracted from the evidence.
   - **Right 4 Columns — Zero-Input Police Action Card & 1-Click Bank Freeze Trigger:**
     - **Isolated Target Account Box:** Automatically highlights the scammer's Beneficiary UPI ID (`apex.verify.settlement@okaxis`), resolved Bank Nodal Desk (`Axis Bank — OKAXIS PSP`), 12-Digit NPCI UTR (`428119482011`), Suspect Phone (`+91-98204-11290`), and Total Exposure (`₹1,84,500`).
     - **Cryptographic Device-Level Verification Pill:** Confirms `SHA-256 & BLAKE3 Intact — Verified at Victim Device` so the duty officer can trust the evidence immediately.
     - **1-Click "Broadcast Bank Freeze Command" Button:** Clicking this single button formats the transaction details into the mandatory [I4C CFCFRMS](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2287674&reg=1&lang=1) / NPCI bank freeze protocol, dispatches the freeze command, logs the action in the Chain-of-Custody ledger, and updates the Citizen Portal's live tracker to **`Bank Notified (Lien Freeze Active)`**.
2. **Stage 2 (`EvidenceVaultView.tsx`): Auto-Classified Evidence & Bounding-Box Inspector**
   - Shows the victim's uploaded screenshots with interactive OCR bounding boxes, EXIF tamper warnings (`"Photo edited"` check), and a 1-byte Tamper Simulation sandbox to demonstrate cryptographic sealing to evaluators.
3. **Stage 3 (`IncidentGraphView.tsx`): Visual Incident Graph & Money-Trail Tracer**
   - Renders the relationship network between people, phone numbers, UPI IDs, bank accounts, URLs, and crypto wallets, with a 1-click **"Trace route"** (Dijkstra shortest path) and automatic **Cross-Complaint Serial Offender detection**.
4. **Stage 4 (`TimelineReconstructionView.tsx`) & Stage 5 (`IntegrityLedgerView.tsx`):**
   - Reconstructs the chronological attack timeline with EXIF vs. OCR timestamp anomaly detection and maintains the Merkle hash-chained Chain-of-Custody ledger.
5. **Stage 6 (`ForensicReportView.tsx`): Maharashtra Cyber Legal Dossier & BSA Section 63 Export**
   - Automatically maps the case to [Bharatiya Nyaya Sanhita (BNS) Section 318(4)](https://devgan.in/bns/section/318/) and [IT Act Sections 66C & 66D](https://siddharthgupta.in/blog/cybercrime-laws-india-2026-it-act-bns-digital-evidence-guide), and exports a court-ready PDF containing the [Section 63(4)(c) Bharatiya Sakshya Adhiniyam (BSA) 2023 Electronic Evidence Certificate](https://www.livelaw.in/articles/bharatiya-sakshya-adhiniyam-transformed-digital-evidence-552681) and the **1930 CFCFRMS Bank Freeze Mandate**.

## 4. Backend Processing Pipeline & Free Cybersecurity / Forensics Tools (100% Java Core)

Your backend remains **100% Java 21 LTS** (using Virtual Threads and Jakarta Servlet 6.1 / Spring Boot 3) and combines open-source Java forensic libraries with free-tier cybersecurity APIs:

| Forensic Task | Free Tool / Java Library | How It Is Implemented in Your Backend |
| :--- | :--- | :--- |
| **Multimodal OCR & Conversational AI** | [Spring AI + Google Gemini API](https://docs.spring.io/spring-ai/reference/api/chat/google-genai-chat.html) (`gemini-2.5-flash`) | Parses messy Indian UPI receipts (PhonePe, GPay, Paytm) into structured JSON (`utr`, `vpa`, `amountInr`, `timestamp`) and drives the 1-question-at-a-time Citizen Chat Assistant. |
| **Local Offline OCR & Bounding Boxes** | [Tess4J (Tesseract OCR Wrapper)](https://tess4j.sourceforge.net/) ([GitHub](https://github.com/nguyenq/tess4j)) | Pure Java JNA wrapper extracting text and pixel bounding boxes (`x, y, width, height`) locally for English, Hindi (`hin`), and Marathi (`mar`). |
| **Metadata, Magic Bytes & EXIF Tamper Check** | [Apache Tika](https://tika.apache.org/) ([GitHub](https://github.com/apache/tika)) | Detects disguised executables via magic bytes, extracts EXIF/PDF metadata, and flags if a screenshot was edited in image software or has mismatched timestamps. |
| **Scammer UPI QR Decoder & Tracking QR** | [ZXing ("Zebra Crossing")](https://github.com/zxing/zxing) | 1) Scans uploaded screenshots for deceptive `upi://pay?pa=...` QR codes to expose hidden scammer VPAs; 2) Generates the tracking QR code on the citizen's receipt. |
| **Phishing Link & Malicious APK Scanning** | [VirusTotal API v3](https://docs.virustotal.com/reference/overview) & [Google Safe Browsing API v4](https://developers.google.com/safe-browsing/v4) | Free-tier REST calls via Java `HttpClient` to check phishing URLs and malicious `.apk` SHA-256 hashes against 70+ antivirus/phishing engines. |
| **URL Redirect & IP Geolocation Enrichment** | [urlscan.io API](https://urlscan.io/docs/api/) & [AbuseIPDB API v2](https://docs.abuseipdb.com/) | Traces shortened phishing links to their hosting IP/country (populating the arcs on `ThreatGlobe.tsx`) and checks IP abuse confidence scores. |
| **Graph Centrality & Shortest Path** | **Google Guava Graph / JGraphT** | Builds a directed weighted graph of entities and computes PageRank, connected scammer clusters, and Dijkstra shortest money-trail paths. |
| **Court PDF & BSA Sec 63 Generator** | [Apache PDFBox](https://pdfbox.apache.org/) / [OpenPDF](https://github.com/librepdf/openpdf) + `jspdf` | Generates the signed Forensic Investigation Dossier, 1930 Bank Freeze Notice, and Section 63(4)(c) BSA Certificate. |

## 5. File-by-File Implementation Checklist

1. **Delete `src/components/landing/EvidencePrism3D.tsx`**: Removes the 3D crystal prism while keeping `src/components/3d/ThreatGlobe.tsx` intact.
2. **Create `src/components/CitizenPortalView.tsx`**: Implements the complete 6-step Victim Portal (Language switcher `EN/HI/MR`, Golden Hour Express shortcut, 8 Smart Incident Picker cards, Zero-Label Evidence Dump with live Web Crypto SHA-256 sealing, AI Conversational Assistant with voice input & OCR auto-confirmation, Tap-to-Edit Review with draft auto-save, and Post-Submission Recovery Hub with QR code, 5-stage live tracker, 1930 checklist, and scam-specific safety tips).
3. **Update `src/components/HomeLandingView.tsx`**: Replaces the removed 3D Prism in the Hero section with the **Citizen Emergency Intake & Golden Hour Express Gateway Card**, allowing 1-click entry into either the Citizen Portal or the Officer Workspace.
4. **Update `src/components/ExecutiveDashboardView.tsx`**: Preserves the 8-column `ThreatGlobe.tsx` and upgrades the right 4 columns with the **Proactive "Golden Hour" Police Action Card** (isolated target UPI/Account, 12-digit UTR, Golden Hour timer, and **1-Click Automated CFCFRMS Bank Freeze Trigger**).
5. **Update `src/App.tsx`, `src/types.ts`, and `src/fallback/installStandaloneDemoFallback.ts`**: Connects the Citizen Portal submissions directly into the live case store andOfficer Triage Queue, adds the `/api/v1/cases/:id/freeze` endpoint, and formats Indian Rupee (`₹`) exposures alongside Maharashtra Cyber legal metadata.
6. **Scaffold `backend/src/main/java/com/cyberfusionx/...`**: Adds the Java 21 backend servlets and forensic services (`CitizenComplaintServlet.java`, `BankFreezeServlet.java`, `QrForensicsService.java`, `BsaSection63Service.java`) matching the frontend API contract.
