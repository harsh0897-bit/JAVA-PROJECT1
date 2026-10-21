# CyberFusion X — Part 3 (Prompt 3 v2 Hardened — Final Approved Plan)

This plan incorporates all mandatory Prompt 3 v2 rules plus the five final fixes. Where any earlier note differed, **Prompt 3 v2 + these five fixes win**.

---

## Five Final Fixes Locked Into Specification

1. **Case-Derived Hub-and-Spoke Globe Arcs (No Invented Countries, Zero Crossings)**:
   - Derive all globe countries, pins, and arcs strictly from the active case's own data (`demoSeedSnapshot.json` / live case payload).
   - Connect arcs in a **hub-and-spoke pattern radiating from the case's control-server country** to the other countries present in that case's data (never hardcoded chains like `US→NL→DE→SG→KY`, and no two arcs may cross).
2. **Stage 6 Case-Derived Flow Diagram & 4 Step Cards (`Photo edited` Badge)**:
   - Derive all Stage 6 flow diagram nodes and labels directly from the active case's data in plain English (no hardcoded `"Pivot Server"` or `"Cloud Storage"` unless present in the case). Clicking any node opens an `AnchoredPopover` with its case details.
   - **Remove** the 5-event incident strip and the 2×2 key facts grid.
   - **Keep the 4 step cards** (showing how the case unfolded step by step), including the **`"Photo edited"`** warning badge on the tampered/edited evidence step.
3. **Stage 1 Key Figures strictly from Existing Case Data**:
   - The 2×2 figures grid on Stage 1 uses **only fields that actually exist in the case data** (e.g., total money/loss amount, affected accounts/entities count, locked/verified evidence files count, timeline events / integrity checks count — never invented metrics like `"Blocked Transfers"`).
4. **Exact Globe Intro Visibility Gate**:
   - Start the globe intro animation when `pageReady === true` AND `entry.intersectionRect.height >= 0.8 * Math.min(cardHeight, viewportHeight)`, with a **2.5s fallback timer** once at least `40%` (`intersectionRatio >= 0.4`) of the card is visible.
5. **Greedy Country Graph-Colouring, Plain Opaque Inner Core/Rings & `"fingerprint"` Terminology**:
   - Use `topojson.neighbors(world.objects.countries.geometries)` + **greedy graph-colouring** across the pastel palette so **two adjacent countries never share the same fill colour**.
   - Use **plain opaque materials** (`meshStandardMaterial` / `meshBasicMaterial` with `transparent: false, opacity: 1, depthWrite: true`) for the homepage prism's inner red/blue diamond and inner red/blue rings so transmission shaders render them cleanly without sorting artifacts.
   - Use the plain word **`"fingerprint"`** (never `"hash"` or `"digest"` as UI labels) throughout user-facing UI text.

---

## Complete Section Breakdown (§1–§12)

### §1. Liquid Glass Shell (`src/index.css`, `WorkspaceHeader.tsx`, `InvestigationStepper.tsx`)
- `.lg` uses `border-radius: 32px`, `isolation: isolate`, `background: linear-gradient(135deg, rgba(255,255,255,.52) 0%, rgba(255,255,255,.20) 100%)`, `backdrop-filter: blur(14px) saturate(190%) brightness(1.04)`, specular top/left inset highlights, and a **pure neutral rim light** (no blue tint).
- Zero `backdrop-filter` on any child element inside the header or stepper shell.
- `rAF`-throttled `pointermove` updates `--mx` and `--my` in px on `.lg` containers.
- Set `<meta name="color-scheme" content="light">` in `index.html`.

### §2. Page Preload, View Transitions, `linear()` Spring Pill & State Persistence (`src/index.css`, `src/App.tsx`, `DropletTabs.tsx`)
- Preload target stage chunks before switching; wrap stage changes in `document.startViewTransition(() => flushSync(() => ...))` with `document.documentElement.dataset.navDir = 'forward' | 'back'` for direction-aware slide.
- Give the shell `view-transition-name: shell` with `::view-transition-group(shell) { animation: none; }`.
- Track `pageReady` (true after first rendered frame of active view); fade WebGL `<Canvas gl={{ alpha: true }}>` in after its first rendered frame.
- Animate the active pill in `DropletTabs` and `InvestigationStepper` using `transform` and `width` (no `scaleX`, keeping corners round) with interruptible stretch-then-spring via the v2 `linear()` spring easing.
- Persist per-case UI state in `sessionStorage` (§2.4) and scroll to top on reload.

### §3. Micro-Interaction Set (`src/index.css`, `src/utils/motion.ts`)
- Hover lift (`translateY(-2px)` + elevated shadow) gated inside `@media (hover: hover) and (pointer: fine)`.
- Press `.97` with spring-back and subtle stretch.
- **3 Magnetic CTAs**: Stage 1 *"Open connection graph"*, Stage 3 *"Trace route"*, Stage 6 *"Download PDF report"*.
- Dropdown spring-open via `linear()` spring, plus drag lift and velocity inertia decay (`0.92` per frame).

### §4. Single `AnchoredPopover` Everywhere (`src/components/layout/AnchoredPopover.tsx`)
- Used for all header menus/popovers **and** Stage 3 Graph *"From"* and *"To"* selectors.
- Only one popover open at a time; flips upward when near the bottom viewport edge; returns focus to trigger on close; renders as a bottom-sheet under `640px`; supports `searchable` filtering for *"From"* and *"To"*.

### §5. Homepage = Golden-Yellow Glass Prism ONLY (`HomeLandingView.tsx`, `EvidencePrism3D.tsx`)
- Full-viewport 3D scene ONLY (no navbar, studio card, tabs, explanation bar, or login buttons; only a hover `"Click to enter"` hint).
- Paper-texture background rendered inside the WebGL scene (`scene.background`) so the golden glass refracts it.
- Golden-yellow glass crystal (`ior: 1.4`, `thickness: 0.9`, `dispersion: 0.35`, warm amber-gold tint).
- **Plain opaque materials** for the red and blue inner diamond and the two inner rings (red and blue).
- Glossy light ceramic pedestal with a rotating dial ring linked directly to the prism's yaw angle.
- Idle float, drag inertia and ease-back, `6px` click-vs-drag threshold, keyboard entry (`Enter`/`Space`), and WebGL fallback button.

### §6. Stage 1 Layout & Intro Timing (`ExecutiveDashboardView.tsx`, `GlobalThreatOriginMap.tsx`)
- Slim case header + **8/4 grid** sized to the viewport (mobile stacks).
- Left (8 cols): full-height globe card.
- Right (4 cols): **2×2 figures grid** using only existing case fields, **2 evidence rows**, and the magnetic **"Open connection graph"** button.
- Globe intro starts when `pageReady && intersectionRect.height >= 0.8 * Math.min(cardHeight, viewportHeight)` with a `2.5s` fallback once `>= 40%` visible.

### §7. Real Coloured Earth Globe (`src/components/3d/ThreatGlobe.tsx`, `src/utils/globeCoords.ts`)
- `world-atlas/countries-50m.json` at `4096×2048` on desktop (`2048×1024` on mobile).
- **Greedy graph-colouring** via `topojson.neighbors` so adjacent countries never share a pastel fill, with crisp borders.
- Separate hover, selected, and dim overlay layers.
- Click countries directly on the globe; non-involved countries show **"No activity in this case"**.
- Case-derived **hub-and-spoke arcs from the control-server country** (zero crossings) with comet tail, arrival ripple, and marker bounce; selecting a country emphasises its arcs.
- Shared coordinate helper + self-check running both math round-trip and `geoContains` on each case marker.
- Focusable country label buttons, `Esc` to clear, *"Reset view"*, and `touch-action` rules.

### §8. Stage 2 Analyze / Evidence Vault (`EvidenceVaultView.tsx`)
- Top thumbnail strip + viewport-filling split of **Viewer** (image/artifact with interactive highlight boxes) + **Inspector** (*Text found in file*, *Fingerprint* with Tamper Test, and *History*). All hash labels use the word **"fingerprint"**.

### §9. Stage 3 Connection Graph (`IncidentGraphView.tsx`)
- `forceCollide` `88`, `forceManyBody` `-1500`, `forceLink` `230`, min node gap `120px`.
- Seeded PRNG + 600-iteration crossing reduction (`< 150ms`).
- Straight links; main links = strongest-link spanning forest + at most 3 extras; selected node reveals its hidden links; traced route reveals any hidden links it uses; *"Show all links"* toggle.
- Fixed `13px` labels; sticky selection until cleared; stored drag positions per case; tracer bar below canvas with searchable `AnchoredPopover` for *"From"* and *"To"*.

### §10, §11 & §12. Stages 4, 5, Stage 6 Visual Report (`ForensicReportView.tsx`), Sweep & Verification
- Stages 4 & 5: plain language (`"fingerprint"`), solid white cards, agreed motion and layout rules.
- Stage 6: remove long *"What happened"* paragraph, remove 5-event strip and 2×2 key facts grid; include **4 count-up tiles**, **case-derived plain-language flow diagram with node popovers**, **4 step cards with `"Photo edited"` badge**, **compact evidence table**, **court-ready icon tiles**, **sign-off card**, and **raw data drawer closed by default**. PDF/JSON/Markdown exports remain byte-identical.
- Run type-check and build after each milestone, execute §11 sweep and §12 10-point verification, and output the complete **Done / Partial / Not done** table.
