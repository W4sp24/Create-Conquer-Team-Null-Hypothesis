# Context Confirmation Flow — Design Spec

**Date:** 2026-06-25
**Status:** Approved design, pending implementation plan
**Project:** AniKonsulta (AIS — Adaptive Intervention Synthesizer)
**Branch:** interactive-enhanced-UX

## Context

Today, clicking "Generate program" can start the pipeline before the AI actually has enough to work with: `canGenerate = ready || preview !== null` lets an Excel upload alone bypass the backend's required-field check, and the button doesn't render at all until that (buggy) condition is true — which reads to a non-technical user as "the button is invisible." Separately, the existing Context Status panel (the one piece of UI the reviewing mentor already likes) only shows checkmarks, not what was actually captured, so a user can't verify the AI understood them correctly before it commits to building a program.

This spec covers making the user a deliberate checkpoint in the pipeline — not just an input source — before the AI agents run, for an audience (NGO program officers, often not technically literate) who needs to *see and trust* what the system knows before it acts. It also covers visual-design treatment for the new surfaces, since "visually appealing" was an explicit requirement, applied within AniKonsulta's existing branded design system (dark forest theme, Fraunces + Hanken Grotesk, leaf/forest/gold/sky tokens) — this is a refinement of an established brand, not a redesign.

**Out of scope for this spec** (covered separately, sequenced after this one per user decision): the Program Output visual roadmap/timeline, other output visualizations, and PPTX export.

## Goals / Non-goals

**Goals**
- The pipeline cannot start until all 3 required context fields (region, crop, beneficiaries) are genuinely captured — closing the Excel-upload bypass.
- The user can see exactly what the AI captured (actual values, not just checkmarks) and explicitly confirm or go back to add more, before any agent runs.
- The Generate action is never invisible — it always renders, with a clear, plain-language explanation of what's still needed when not yet ready.
- A signature visual moment (the "seal" motif, §Visual Design) makes confirmation feel concrete and trustworthy without inventing new brand colors.

**Non-goals**
- No inline field-editing widgets on the new screen — "going back" returns to the chat thread (where the existing conversational intake already works well), not a form.
- No change to the chat assistant's required-field **gating** logic — `chat_assistant.py`'s rule that `ready` cannot be true with a required field missing is already correct and stays untouched.
- No changes to Output/roadmap/PPTX — separate spec.

**Correction from initial draft:** showing the *actual captured value* per field (Goal 2) is not achievable with zero backend changes — `POST /chat` today returns only `captured_fields: list[str]` (which keys are captured), never the value extracted for each. A small, contained backend addition is required: the assistant must also return what it extracted. See §4a below.

## Design

### 1. New "Review Context" screen
A new route (`/review`) inserted into the existing flow: `Input → Review Context → Agent Status → Output`. Reached only via the (now-always-rendered) Generate button once `ready === true`. Shows one card per tracked field (`region`, `crop`, `beneficiaries`, `budget`, `staff`):
- **Captured required/optional fields:** the actual value the assistant extracted, in plain language, with the seal icon.
- **Not-yet-provided optional fields:** shown as "Not provided — program will use general defaults," never hidden, so the user knows what they could still add.

Two large actions at the bottom: **"← Add more info"** (navigates back to `/`, the existing Input page, with chat history and excel preview state preserved) and **"Looks right — generate →"** (proceeds to `/status`, starting the run exactly as today's `handleGenerate` does).

### 2. Context Status panel upgrade
On the Input page's existing right-hand panel:
- Each captured field shows its real value beneath the label (e.g. "Region" / "Coastal Cebu, typhoon-prone"), not just a checkmark — the same data the new Review screen shows, so the two surfaces feel like one continuous idea, not duplicated UI.
- Each field gets a one-line "why this matters" string, shown as small muted text under the label, written in plain language (e.g. staff → "Affects how many rollout phases we suggest").
- Once ready, the footer becomes an actual button — **"Review & generate →"** — navigating to `/review`, so the panel becomes a path into the flow, not just a passive status display.

### 3. Generate button / gating fix
In `InputPage.tsx`: `canGenerate = ready || preview !== null` → drop the bypass entirely; the button's *visibility* is no longer conditional at all — it is **always rendered**, with two states:
- **Not ready:** disabled, muted styling, label states what's missing in plain language (e.g. "Add crop & beneficiaries to continue") computed from `missing_required` rather than a generic "complete the form" message.
- **Ready:** the existing solid green gradient button, label and action become **"Review your context →"** (navigates to `/review` instead of calling `startRun` directly — `handleGenerate`'s actual pipeline-start call moves to the new Review screen's "Generate" action).

This single change fixes the "invisible button" complaint (something is always visible) and enforces the "don't run until required fields are met" requirement (the only path to starting a run requires passing through the now-correctly-gated button into a screen that itself requires `ready`).

### 4. Chat assistant persistence
No change to gating — `chat_assistant.py` already cannot return `ready: true` with a required field missing, and its fallback already asks for the next missing required field one at a time. This spec relies on that being correct, and does not modify it.

### 4a. Backend addition: return captured values, not just keys
`chat_assistant.py`'s `SYSTEM_PROMPT` JSON schema gains one field: `"field_values": {"<field_key>": "<short extracted value>", ...}` for whichever fields are in `captured_fields` (the LLM already has this information when it decides a field is captured — it is only not currently asked to report it). `run_chat_assistant` parses and returns `field_values: dict[str, str]`, filtered to keys in `ALL_FIELDS`, defaulting to `{}` on any failure (same fallback posture as `captured_fields`/`ready` today). `routes/input.py`'s `ChatResponse` gains `field_values: dict[str, str] = {}`, populated from the assistant's result. This is additive to an existing, working JSON contract — not a new endpoint or a change to gating.

## Visual Design (frontend-design pass)

Applied within AniKonsulta's existing token system — no new colors, no new typefaces. Per `tailwind.config.ts`: `forest`/`leaf`/`gold`/`sky` already exist; `gold` is documented as "used sparingly for badges/highlights," which this spec uses literally.

**Signature element — the seal:** a small custom SVG "confirmation seal" (a circular stamp shape with a simple checkmark or leaf glyph inside, rendered in `gold` on the dark page background and in `forest` on white cards) replaces the generic `Check` icon for *every* "captured" state across both the Context Status panel and the new Review screen — this is the one consistent visual idea readers will associate with "the AI has this." It is deliberately NOT used anywhere else in the app, so it stays meaningful.

**The one orchestrated motion moment:** when the last required field transitions to captured (in the Context Status panel, live as the user chats), the seal "stamps" in with a short scale-up-then-settle (≈220ms, spring easing — reusing the existing `spring` timing function already defined in `tailwind.config.ts`) rather than the generic `animate-bounce-in` used elsewhere. This is the single deliberate animation beat for this feature; every other transition (field cards arriving, screen navigation) uses the app's existing `animate-rise`/`animate-slide-in-up` patterns, unchanged — restraint around the one signature moment, not motion everywhere.

**Layout, Review screen:** full-width card stack on `canvas` background (consistent with Input/Output pages), each field card large enough to read at a glance (generous padding, 16px+ body text per accessibility floor), two-button footer fixed at the bottom on mobile so the actions are never scrolled out of reach — a real consideration for a non-technical user on a phone in the field.

**Copy voice:** plain, direct, second-person where natural ("Add crop & beneficiaries to continue," not "Required fields incomplete"). No jargon ("context payload," "ready flag") ever surfaces in UI text — confirmed against existing copy conventions in `ChatBox.tsx`/`ContextStatus.tsx`, which already follow this register.

**Accessibility floor (non-negotiable, not a stretch goal given the audience):** seal icon always paired with text, never color-alone; disabled Generate button has real explanatory text, not just reduced opacity; 44px+ tap targets on both new buttons; respects `prefers-reduced-motion` (the stamp animation drops to a simple opacity fade).

## Critical files

| File | Change |
|---|---|
| `backend/agents/chat_assistant.py` | `SYSTEM_PROMPT` gains the `field_values` instruction; `run_chat_assistant` returns `field_values: dict[str, str]` |
| `backend/routes/input.py` | `ChatResponse` gains `field_values: dict[str, str] = {}`, populated in `process_chat` |
| `frontend/src/types/index.ts` | `ChatTurnResponse` gains `field_values: Record<string, string>`; `ContextField.detail` becomes the real captured value (already optional-string typed — no shape change needed there) |
| `frontend/src/lib/api.ts` | `sendChat`'s network-failure fallback object gains `field_values: {}` |
| `frontend/src/components/ConfirmationSeal.tsx` | **New** — the seal SVG icon, used by both Context Status and the new screen |
| `frontend/src/components/ContextStatus.tsx` | Show `field.detail` (the real value) instead of the literal word "captured"; add "why this matters" text; swap `Check` for `ConfirmationSeal`; add "Review & generate" button when ready |
| `frontend/src/components/ChatBox.tsx` | Generate button always renders; label/state driven by `ready` + `missing_required` |
| `frontend/src/pages/InputPage.tsx` | Fix `canGenerate` (drop the bypass); store `fieldValues` state from `res.field_values`; build `fields` using real values; `handleGenerate` navigates to `/review` instead of calling `startRun` directly |
| `frontend/src/pages/ReviewContextPage.tsx` | **New** — the Review Context screen; owns the actual `startRun` call (moved from `InputPage`) |
| `frontend/src/App.tsx` | Add the `/review` route |
| `frontend/tailwind.config.ts` | Add the `stamp` keyframe/animation (scale-up-then-settle) alongside existing keyframes — no new colors |

Backend change is additive only (new response field, same endpoint, same gating rule) — no new endpoints, no schema breakage for existing fields.

## Testing / Verification

No automated frontend test suite exists in this repo (confirmed in prior sessions) — verification is `cd frontend && npm run build` succeeding, plus manual walkthroughs:
- Upload an Excel file with no usable region/crop/beneficiary data, confirm the Generate button stays disabled with explanatory text (the bypass is actually closed).
- Complete the chat until `ready === true`, confirm the button becomes "Review your context →" and the new screen shows real captured values.
- Click "Add more info" from the Review screen, confirm it returns to Input with chat history intact.
- Click "Looks right — generate →", confirm the run actually starts (same `POST /run` behavior as today).
- Toggle `prefers-reduced-motion` and confirm the seal stamp degrades to a fade, not a jump cut.
- `cd backend && pytest tests/test_routes.py -v` after the `field_values` addition — existing `/chat` contract tests must still pass, plus confirm a captured field's value is a non-empty string in the response.
