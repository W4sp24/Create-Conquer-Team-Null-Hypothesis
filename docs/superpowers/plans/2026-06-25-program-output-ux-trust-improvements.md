# Program Output UX & Trust Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AniKonsulta's existing program-design pitch (grounded, context-adapted, auditable) *visible* in the UI — surface trust signals (citations, confidence) that are currently computed but buried or absent, fix a real accessibility gap (color-only risk signal, silent SSE updates), and add a first-run explainer and an export path.

**Architecture:** This is a frontend-only plan. Every task reuses data the backend already returns (`citations`, `confidence_level`, `risk_assessment.risk_level`) — no backend changes, no new dependencies. Each task is independent and can be implemented or skipped on its own.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS 3.4 (existing tokens only), `lucide-react` (existing dep, only using icons already in the installed set), no new npm packages.

## Global Constraints

- No new npm dependency — confirmed via `frontend/package.json` audit: no charting library, no PDF library installed today. Use only `lucide-react`, Tailwind, and native browser APIs (`window.print`, `localStorage`).
- No backend changes — confirmed via code audit: `per_beneficiary_cost_usd` and `total_budget_estimate` are hardcoded to `None` in `agents/synthesizer.py` (comment: `# Budget planner not in MVP`), and no budget-benchmark documents exist in `backend/knowledge_base/raw_docs/`. Any "budget by phase" or "cost vs. benchmark" visualization is **out of scope** for this plan — see "Deferred" section at the end.
- Reuse existing Tailwind tokens only (`leaf`, `leaf-soft`, `forest`, `gold`, `sky`, `cream`, `hairline`, default Tailwind `red-*`/`amber-*` shades already used elsewhere in the codebase, e.g. `AgentCard.tsx`'s `bg-red-100 text-red-600` error state) — do not invent new color tokens.
- Never convey information by color alone — every status/risk indicator must pair color with an icon and a text label (per the accessibility gap found: `risk_level` is currently plain text with **no** visual distinction at all, which is the opposite problem — fix by adding color+icon+text together, not color alone).
- No automated frontend test harness exists in this repo (confirmed: zero `*.test.ts(x)` files). Every task is verified manually in a running dev server, not with unit tests — this matches how the rest of the frontend ships today.

## Context

This plan implements the UI/UX brainstorm from the prior conversation, scoped down to what the current data model and dependencies actually support (verified by reading the real code, not assumed). Two brainstormed ideas are explicitly **cut**, not silently dropped: a budget-by-phase chart and a cost-vs-benchmark comparison, both blocked on the not-yet-built Budget Planner agent (CLAUDE.md: "v2 post-hackathon") and missing benchmark source documents. The dynamic Agent Status UI (replacing the hardcoded 5-card list with planner-driven cards) is **also excluded here** — it's already fully specified in the separate Adaptive Orchestration plan; this plan's Task 4 (aria-live) is written to apply cleanly to either the current or the future reworked `useAgentStream.ts`.

What's left, and what this plan covers: the program-output screen tells a "grounded, auditable, context-adapted" story that the UI doesn't currently surface (citations and confidence are computed but easy to miss), one real accessibility gap (no visual risk signal at all today), and two structural gaps (no onboarding explainer, no way to get the output out of the browser tab).

## File Structure

| File | Responsibility |
|---|---|
| `frontend/src/components/RiskBadge.tsx` (new) | Maps a risk level string to a color+icon+label badge — single source of truth for risk visualization, reused wherever risk level is shown. |
| `frontend/src/components/ProgramOutput.tsx` (modify) | Header gains a `RiskBadge` + grounding/confidence trust stats; Citations section grouped by source type with an anchor id. |
| `frontend/src/pages/AgentStatusPage.tsx` (modify) | Adds a visually-hidden `aria-live` region announcing agent status changes as they happen. |
| `frontend/src/pages/InputPage.tsx` (modify) | Adds a dismissible first-run "How this works" explainer banner. |
| `frontend/src/pages/OutputPage.tsx` (modify) | Adds a Print/Export button. |
| `frontend/src/index.css` (modify) | Adds a `@media print` block so the printed/exported output hides chrome (nav, buttons) and shows only the program content. |

---

### Task 1: `RiskBadge` component + integrate into Program Output header

**Files:**
- Create: `frontend/src/components/RiskBadge.tsx`
- Modify: `frontend/src/components/ProgramOutput.tsx`

**Interfaces:**
- Produces: `export default function RiskBadge({ level }: { level: string }): JSX.Element` — consumed by `ProgramOutput.tsx`.

Today `risk.risk_level` renders as plain text inside the generic `Stat` badge (`<Stat label="Risk" value={risk.risk_level} />` in `ProgramOutput.tsx`) — no color, no icon, no visual urgency signal at all. This task fixes that gap.

- [ ] **Step 1: Create `frontend/src/components/RiskBadge.tsx`**

```tsx
import { ShieldCheck, AlertTriangle, ShieldAlert, HelpCircle } from 'lucide-react'

const RISK_META: Record<
  string,
  { bg: string; text: string; icon: typeof ShieldCheck; label: string }
> = {
  low: { bg: 'bg-leaf-soft', text: 'text-forest', icon: ShieldCheck, label: 'Low risk' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle, label: 'Medium risk' },
  high: { bg: 'bg-red-100', text: 'text-red-600', icon: ShieldAlert, label: 'High risk' },
  unknown: { bg: 'bg-cream', text: 'text-secondary', icon: HelpCircle, label: 'Risk unknown' },
}

/** Risk level shown as color + icon + text together — never color alone. */
export default function RiskBadge({ level }: { level: string }) {
  const meta = RISK_META[level] ?? RISK_META.unknown
  const Icon = meta.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${meta.bg} ${meta.text}`}
    >
      <Icon size={14} strokeWidth={2} />
      {meta.label}
    </span>
  )
}
```

- [ ] **Step 2: Wire it into `ProgramOutput.tsx`'s header**

Add the import at the top of `frontend/src/components/ProgramOutput.tsx`:

```tsx
import RiskBadge from './RiskBadge'
```

Replace this line (currently in the header `Stat` row):

```tsx
<Stat label="Risk" value={risk.risk_level} />
```

with:

```tsx
<RiskBadge level={risk.risk_level} />
```

- [ ] **Step 3: Manually verify**

Run: `cd frontend && npm run dev`, navigate to an Output page with a completed run (or use the existing `/compare` preset contexts to generate one quickly). Confirm the risk badge shows a colored pill with an icon and a text label (e.g. amber triangle + "Medium risk"), not plain text. Temporarily edit a test response or check each of `low`/`medium`/`high`/`unknown` render distinctly by inspecting `RISK_META` in dev tools or testing with mocked data if convenient.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/RiskBadge.tsx frontend/src/components/ProgramOutput.tsx
git commit -m "feat: add color+icon+text risk badge to Program Output header"
```

---

### Task 2: Grounding/trust header stats (citation count + confidence explainer)

**Files:**
- Modify: `frontend/src/components/ProgramOutput.tsx`

**Interfaces:**
- Consumes: `program.citations: string[]` (format `"[Global: ...]"` / `"[Org: ...]"` / `"[No sources retrieved...]"`, per `backend/agents/synthesizer.py::_build_citations`), `program.confidence_level: number`.
- Produces: a `countCitationsBySource` helper and a "Jump to sources" scroll target consumed by Task 3's `id="citations"` anchor.

Citations and confidence are computed by the backend on every run but currently easy to miss — citations sit at the very bottom of the page, confidence is a bare percentage. This task makes both a visible, explained trust signal right in the header.

- [ ] **Step 1: Add a helper function near the bottom of `ProgramOutput.tsx`** (alongside the existing `Stat`/`RiskList` helpers)

```tsx
function countCitationsBySource(citations: string[]): { global: number; org: number; none: boolean } {
  let global = 0
  let org = 0
  for (const c of citations) {
    if (c.startsWith('[Global:')) global++
    else if (c.startsWith('[Org:')) org++
  }
  return { global, org, none: global === 0 && org === 0 }
}
```

- [ ] **Step 2: Replace the existing `Confidence` stat and add a grounding stat**

In `ProgramOutput.tsx`, find the header stats row:

```tsx
<div className="mt-4 flex flex-wrap gap-2">
  <Stat label="Confidence" value={`${Math.round(program.confidence_level * 100)}%`} />
  <RiskBadge level={risk.risk_level} />
  {program.per_beneficiary_cost_usd != null && (
    <Stat label="Cost / beneficiary" value={`$${program.per_beneficiary_cost_usd}`} />
  )}
</div>
```

Replace it with:

```tsx
<div className="mt-4 flex flex-wrap items-center gap-2">
  <span
    className="rounded-full border border-hairline bg-canvas/60 px-3 py-1.5 text-[12px] text-secondary"
    title="Reflects how complete and specific the input data was — more detail in your Excel/chat context raises this score."
  >
    Confidence:{' '}
    <span className="font-semibold text-primary">{Math.round(program.confidence_level * 100)}%</span>
  </span>
  <RiskBadge level={risk.risk_level} />
  {program.per_beneficiary_cost_usd != null && (
    <Stat label="Cost / beneficiary" value={`$${program.per_beneficiary_cost_usd}`} />
  )}
  <GroundingBadge citations={program.citations} />
</div>
```

- [ ] **Step 3: Add the `GroundingBadge` component**, placed near the other helper functions at the bottom of the file:

```tsx
function GroundingBadge({ citations }: { citations: string[] }) {
  const { global, org, none } = countCitationsBySource(citations)

  function scrollToCitations() {
    document.getElementById('citations')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (none) {
    return (
      <span className="rounded-full border border-hairline bg-canvas/60 px-3 py-1.5 text-[12px] text-secondary">
        No sources retrieved yet
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={scrollToCitations}
      className="rounded-full border border-hairline bg-canvas/60 px-3 py-1.5 text-[12px] text-secondary transition-colors hover:border-leaf hover:text-forest"
      title="Jump to the full source list at the bottom of this program"
    >
      Grounded in{' '}
      <span className="font-semibold text-primary">
        {global} specialized{org > 0 ? ` + ${org} your docs` : ''}
      </span>
    </button>
  )
}
```

- [ ] **Step 4: Manually verify**

Run the dev server, open a completed program. Confirm: the Confidence pill shows a hover tooltip (native `title` attribute) explaining what the number means; the new "Grounded in N specialized..." button appears in the header and, when clicked, smooth-scrolls down to the Citations section (added in Task 3 — if Task 3 isn't done yet, it will scroll to nothing since `id="citations"` doesn't exist yet; do Task 3 before or together with this step for a working demo). Test the `none` branch by checking a run where no specialized KB docs are ingested (the existing fallback citation string `"[No sources retrieved — upload docs via POST /sources/upload]"` should produce the "No sources retrieved yet" pill, not a broken "0 specialized" count).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ProgramOutput.tsx
git commit -m "feat: surface citation count and confidence explainer in Program Output header"
```

---

### Task 3: Group Citations section by source type + add scroll anchor

**Files:**
- Modify: `frontend/src/components/ProgramOutput.tsx`

**Interfaces:**
- Consumes: `program.citations: string[]`.
- Produces: `id="citations"` DOM anchor, consumed by Task 2's `GroundingBadge` scroll-to behavior.

Today citations render as one flat bulleted list with no grouping. This task groups them by `[Global: ...]` vs `[Org: ...]` with a distinct icon per group, and gives the section a stable scroll target.

- [ ] **Step 1: Add the import**

In `ProgramOutput.tsx`'s import block, add `FolderOpen` to the existing `lucide-react` import line:

```tsx
import {
  Sparkles,
  Target,
  ListChecks,
  CalendarRange,
  Users,
  ShieldAlert,
  BookMarked,
  FolderOpen,
  Wand2,
} from 'lucide-react'
```

- [ ] **Step 2: Replace the Citations section**

Find the current Citations block:

```tsx
{program.citations.length > 0 && (
  <Section icon={<BookMarked size={16} strokeWidth={1.7} />} title="Citations" delay={6}>
    <ul className="space-y-1.5">
      {program.citations.map((c, i) => (
        <li key={i} className="text-[13px] text-secondary">
          {c}
        </li>
      ))}
    </ul>
  </Section>
)}
```

Replace it with:

```tsx
{program.citations.length > 0 && (
  <div id="citations">
    <Section icon={<BookMarked size={16} strokeWidth={1.7} />} title="Citations" delay={6}>
      <CitationGroup
        icon={<BookMarked size={14} strokeWidth={1.7} className="text-forest" />}
        label="Specialized knowledge base"
        items={program.citations.filter((c) => c.startsWith('[Global:'))}
      />
      <CitationGroup
        icon={<FolderOpen size={14} strokeWidth={1.7} className="text-forest" />}
        label="Your organization's documents"
        items={program.citations.filter((c) => c.startsWith('[Org:'))}
      />
      {program.citations.every((c) => !c.startsWith('[Global:') && !c.startsWith('[Org:')) && (
        <p className="text-[13px] text-secondary">{program.citations[0]}</p>
      )}
    </Section>
  </div>
)}
```

- [ ] **Step 3: Add the `CitationGroup` helper**, near the other helpers at the bottom of the file:

```tsx
function CitationGroup({
  icon,
  label,
  items,
}: {
  icon: React.ReactNode
  label: string
  items: string[]
}) {
  if (items.length === 0) return null
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-label text-secondary">
        {icon}
        {label}
      </div>
      <ul className="space-y-1.5">
        {items.map((c, i) => (
          <li key={i} className="text-[13px] text-secondary">
            {c}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Manually verify**

Run the dev server, open a completed program with both specialized and org citations present (or just specialized — confirm groups with zero items render nothing rather than an empty heading). Confirm clicking the header's "Grounded in..." button (Task 2) scrolls smoothly to this section.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ProgramOutput.tsx
git commit -m "feat: group citations by source type with scroll anchor"
```

---

### Task 4: `aria-live` announcements for SSE Agent Status updates

**Files:**
- Modify: `frontend/src/pages/AgentStatusPage.tsx`

**Interfaces:**
- Consumes: `useAgentStream(runId)`'s current return shape — `{ agents, done, error }` (or, if the separate Adaptive Orchestration plan has already shipped by the time this task is implemented, the reworked shape `{ agents, planning, planRationale, planSource, done, error }` — the pattern below only needs `agents`, which exists in both shapes).

Confirmed via codebase search: zero uses of `aria-live` or `role="alert"` anywhere in the frontend today. A screen-reader user gets no feedback as agents move through pending → running → done — this task adds a visually-hidden live region that announces each transition.

- [ ] **Step 1: Add a visually-hidden live region to `AgentStatusPage.tsx`**

In `frontend/src/pages/AgentStatusPage.tsx`, inside the `return` block that renders the agent cards (the branch that currently starts with `<FloatingParticles />` / `<TopNav />` for an active run), add this element right after the opening of `<main>`:

```tsx
<p aria-live="polite" className="sr-only">
  {agents
    .filter((a) => a.status === 'done' || a.status === 'error')
    .map((a) => `${a.id.replace(/_/g, ' ')}: ${a.status}`)
    .join('. ')}
</p>
```

This relies on a `sr-only` utility class. Check `frontend/src/index.css` — if `.sr-only` isn't already defined (Tailwind's default preset includes it as a core utility, so it should already work via the `sr-only` class without any CSS file changes, since Tailwind ships this utility by default and it wasn't removed from the config's `corePlugins`).

- [ ] **Step 2: Manually verify**

Run the dev server with a screen reader enabled (Windows Narrator: `Ctrl+Win+Enter` to toggle), or inspect via browser dev tools that the element's text content updates as `agent_status` SSE events arrive (watch the Elements panel update live as a run progresses). Confirm the element is visually hidden (no layout shift) but present in the accessibility tree.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AgentStatusPage.tsx
git commit -m "feat: add aria-live announcements for agent status changes"
```

---

### Task 5: First-run "How this works" explainer banner on Input page

**Files:**
- Modify: `frontend/src/pages/InputPage.tsx`

**Interfaces:**
- Produces: a dismissible banner gated by a `localStorage` key `"anikonsulta:seen-explainer"` — no other file depends on this.

Confirmed via codebase search: no existing `localStorage` usage anywhere, so this introduces the pattern fresh. For a first-time NGO user, the live multi-agent screen that follows can otherwise read as either showmanship or an opaque black box — this banner sets expectations in three short steps before they ever click "Generate program."

- [ ] **Step 1: Add explainer state to `InputPage.tsx`**

Near the other `useState` calls at the top of the `InputPage` component function, add:

```tsx
const [showExplainer, setShowExplainer] = useState(
  () => localStorage.getItem('anikonsulta:seen-explainer') !== '1',
)

function dismissExplainer() {
  localStorage.setItem('anikonsulta:seen-explainer', '1')
  setShowExplainer(false)
}
```

- [ ] **Step 2: Add the `ExplainerBanner` component**, defined near the other helper components at the bottom of the file (alongside `TopNav`/`PanelCard`):

```tsx
function ExplainerBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="card-surface mb-5 flex items-start gap-4 rounded-card border border-leaf/30 bg-leaf-soft/40 p-5 animate-rise">
      <Sprout size={20} strokeWidth={1.7} className="mt-0.5 shrink-0 text-forest" />
      <div className="flex-1">
        <h2 className="font-display text-[15px] font-semibold text-primary">How this works</h2>
        <ol className="mt-2 space-y-1.5 text-[13px] text-secondary">
          <li>1. Upload your field data (Excel) or describe it in chat.</li>
          <li>2. A team of specialist agents analyzes it against verified evidence — you'll watch them work, live.</li>
          <li>3. You get a complete program with every claim traced to a source, plus a list of what was adapted for your context.</li>
        </ol>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-full px-2 py-1 text-[12px] text-secondary transition-colors hover:bg-cream hover:text-primary"
        aria-label="Dismiss explainer"
      >
        Got it
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Render it above the 3-panel grid**

In `InputPage.tsx`'s `return` statement, inside `<main>`, right before the `{/* Desktop: 3-column workspace of rich cards */}` comment, add:

```tsx
{showExplainer && <ExplainerBanner onDismiss={dismissExplainer} />}
```

- [ ] **Step 4: Manually verify**

Run the dev server, open the Input page in a fresh browser profile (or clear `localStorage` via dev tools: `localStorage.removeItem('anikonsulta:seen-explainer')`). Confirm the banner appears once, and clicking "Got it" dismisses it and it does not reappear on reload (confirm via `localStorage.getItem('anikonsulta:seen-explainer')` returning `'1'` in the console).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/InputPage.tsx
git commit -m "feat: add dismissible first-run explainer banner to Input page"
```

---

### Task 6: Print/export support for Program Output

**Files:**
- Modify: `frontend/src/pages/OutputPage.tsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Produces: a "Print / Export" button calling `window.print()` — no new dependency, since `frontend/package.json` confirmed has no PDF library installed today.

The generated program's real destination is a grant report or board deck — there's currently no way to get it out of the browser tab except copy-pasting. `window.print()` (which every browser can also "Save as PDF" through) is the zero-dependency v1; a dedicated PDF library is a reasonable future upgrade if this isn't sufficient, but isn't justified yet.

- [ ] **Step 1: Add a print stylesheet to `frontend/src/index.css`**

Append to the end of `frontend/src/index.css`:

```css
@media print {
  header,
  nav,
  .no-print {
    display: none !important;
  }
  body {
    background: #fff !important;
  }
  .card-surface {
    box-shadow: none !important;
    border: 1px solid #e7e3d7;
  }
}
```

- [ ] **Step 2: Add the Print button to `OutputPage.tsx`**

Add `Printer` to the existing `lucide-react` import line:

```tsx
import { ArrowLeft, GitCompare, Loader2, Printer } from 'lucide-react'
```

Find the block that renders the ready state:

```tsx
{status === 'ready' && program && (
  <>
    <ProgramOutputView program={program} />
    <div className="mt-8 flex justify-center">
      <Link
        to="/compare"
        className="pill inline-flex items-center gap-2 border border-hairline bg-white px-5 py-2.5 text-[14px] font-medium text-forest transition-all duration-300 hover:scale-105 hover:border-leaf hover:shadow-glow"
      >
        <GitCompare size={16} strokeWidth={1.8} />
        Compare two contexts
      </Link>
    </div>
  </>
)}
```

Replace it with:

```tsx
{status === 'ready' && program && (
  <>
    <div className="no-print mb-4 flex justify-end">
      <button
        type="button"
        onClick={() => window.print()}
        className="pill inline-flex items-center gap-2 border border-hairline bg-white px-4 py-2 text-[13px] font-medium text-forest transition-all duration-300 hover:scale-105 hover:border-leaf hover:shadow-glow"
      >
        <Printer size={15} strokeWidth={1.8} />
        Print / Export
      </button>
    </div>
    <ProgramOutputView program={program} />
    <div className="no-print mt-8 flex justify-center">
      <Link
        to="/compare"
        className="pill inline-flex items-center gap-2 border border-hairline bg-white px-5 py-2.5 text-[14px] font-medium text-forest transition-all duration-300 hover:scale-105 hover:border-leaf hover:shadow-glow"
      >
        <GitCompare size={16} strokeWidth={1.8} />
        Compare two contexts
      </Link>
    </div>
  </>
)}
```

Also add `className="no-print"` to the `TopNav` usage if `TopNav` doesn't already render inside a `<header>` tag — check `frontend/src/components/TopNav.tsx`: if its root element is a `<header>`, the `@media print { header { display: none } }` rule from Step 1 already hides it and no change is needed here.

- [ ] **Step 3: Manually verify**

Run the dev server, open a completed program, click "Print / Export," and use the browser's print preview (or "Save as PDF" destination). Confirm the nav bar, the print button itself, and the "Compare two contexts" link are hidden in the preview, while the program content (header, intervention, KPIs, citations, etc.) prints cleanly on a white background.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/OutputPage.tsx frontend/src/index.css
git commit -m "feat: add print/export support for Program Output"
```

---

## Deferred (explicitly cut from this plan, not silently dropped)

Two brainstormed ideas are **not** included as tasks above, because the current backend data model doesn't support them honestly:

- **Budget-by-phase bar chart** — `RolloutPhase` has no cost field, and `per_beneficiary_cost_usd`/`total_budget_estimate` are hardcoded `None` in `agents/synthesizer.py` today (`# Budget planner not in MVP`). This needs the not-yet-built Budget Planner agent (CLAUDE.md: "v2 post-hackathon") before any cost visualization has real data to show.
- **Per-beneficiary cost vs. industry benchmark** — same blocker, plus no budget-benchmark documents exist in `backend/knowledge_base/raw_docs/` (only agronomic/statistical PDFs are ingested today) to retrieve a benchmark figure from even if the cost field existed.

If/when the Budget Planner ships, both become straightforward additions to `ProgramOutput.tsx` reusing the same `Section`/badge patterns established in this plan.

## Verification (end-to-end)

1. `cd frontend && npm run dev` — manually walk through: Input page shows the explainer once and not again after dismissal; generate a run; Agent Status page's live region updates (inspect via Elements panel or a screen reader); Output page shows the risk badge with color+icon, the grounding/confidence header stats, grouped citations reachable via the header button's smooth scroll, and a working Print/Export button.
2. `cd frontend && npm run build` — confirm a clean production build with no new TypeScript errors introduced by these changes.
