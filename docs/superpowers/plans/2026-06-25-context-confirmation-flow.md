# Context Confirmation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the user a deliberate checkpoint in the AniKonsulta pipeline — a new "Review Context" screen shows exactly what the AI captured before any agent runs, the Generate button always renders with plain-language status instead of disappearing, and the required-field gating bypass is closed.

**Architecture:** One small additive backend contract change (the chat assistant starts reporting *what* it captured per field, not just *which* fields), then five frontend changes that consume it: a new seal icon + animation primitive, an upgraded Context Status panel, an always-visible Generate button, the gating fix in `InputPage`, and a new `ReviewContextPage` reached via React Router navigation `state` (so chat history survives the round trip without adding a global store).

**Tech Stack:** FastAPI + Pydantic (backend), React 18 + TypeScript + React Router v6 + Tailwind (frontend). No new dependencies.

## Global Constraints

- No change to `chat_assistant.py`'s required-field gating rule: `ready` must still be false whenever a required field (`region`, `crop`, `beneficiaries`) is missing from `captured_fields`.
- No new npm or pip dependencies.
- No new colors — reuse existing Tailwind tokens (`forest`, `leaf`, `gold`, `sky`, `canvas`, `panel`, `primary`, `secondary`, `hairline`).
- The seal icon (`ConfirmationSeal`) is the only icon used for "captured" states across `ContextStatus.tsx` and `ReviewContextPage.tsx` — do not reintroduce `lucide-react`'s `Check` for this purpose.
- All new interactive elements respect `prefers-reduced-motion` (Tailwind's `motion-reduce:` variant).
- No inline field-editing form on `ReviewContextPage` — "Add more info" only navigates back to `/`.
- Backend repo has a real pytest suite — every backend step must follow TDD (failing test → implementation → passing test). Frontend repo has **no** automated test suite (confirmed in prior work on this codebase) — frontend steps are verified by `cd frontend && npm run build` succeeding, plus the manual checks named in each task.

---

### Task 1: Backend — return captured field values, not just keys

**Files:**
- Modify: `backend/agents/chat_assistant.py`
- Modify: `backend/routes/input.py`
- Create: `backend/tests/test_chat_assistant.py`
- Modify: `backend/tests/test_routes.py`

**Interfaces:**
- Produces: `run_chat_assistant(...)` return dict gains key `"field_values": dict[str, str]` (already returns `"reply"`, `"captured_fields"`, `"ready"`). `ChatResponse` (Pydantic, in `routes/input.py`) gains field `field_values: dict[str, str] = {}`.

- [ ] **Step 1: Write the failing tests for `run_chat_assistant`**

Create `backend/tests/test_chat_assistant.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch

from models import ChatMessage
from agents.chat_assistant import run_chat_assistant


@pytest.mark.asyncio
async def test_run_chat_assistant_returns_field_values():
    """field_values carries the assistant's extracted value for each captured field."""
    mock_response = """{
        "reply": "Got it -- what crop is the focus?",
        "captured_fields": ["region"],
        "field_values": {"region": "Coastal Cebu, typhoon-prone"},
        "ready": false
    }"""
    with patch("agents.chat_assistant.call_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_response

        result = await run_chat_assistant(
            [ChatMessage(role="user", content="We farm in coastal Cebu")], None
        )

        assert result["field_values"] == {"region": "Coastal Cebu, typhoon-prone"}


@pytest.mark.asyncio
async def test_run_chat_assistant_drops_values_for_uncaptured_fields():
    """field_values is filtered to only the fields actually in captured_fields."""
    mock_response = """{
        "reply": "What crop is the focus?",
        "captured_fields": ["region"],
        "field_values": {"region": "Coastal Cebu", "crop": "should be dropped"},
        "ready": false
    }"""
    with patch("agents.chat_assistant.call_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_response

        result = await run_chat_assistant(
            [ChatMessage(role="user", content="We farm in coastal Cebu")], None
        )

        assert result["field_values"] == {"region": "Coastal Cebu"}
        assert "crop" not in result["field_values"]


@pytest.mark.asyncio
async def test_run_chat_assistant_field_values_empty_on_llm_failure():
    """On any LLM/parse failure, field_values falls back to an empty dict."""
    with patch("agents.chat_assistant.call_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.side_effect = Exception("LLM error")

        result = await run_chat_assistant(
            [ChatMessage(role="user", content="hello")], None
        )

        assert result["field_values"] == {}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pytest tests/test_chat_assistant.py -v`
Expected: FAIL — `KeyError: 'field_values'` on all three tests (the key does not exist yet in the returned dict).

- [ ] **Step 3: Implement `field_values` in `chat_assistant.py`**

In `backend/agents/chat_assistant.py`, update `SYSTEM_PROMPT`'s JSON contract — replace this block:

```python
Return ONLY valid JSON, no prose outside it:
{
  "reply": "your conversational message to the user",
  "captured_fields": ["region", "crop", ...],
  "ready": true or false
}
"""
```

with:

```python
Return ONLY valid JSON, no prose outside it:
{
  "reply": "your conversational message to the user",
  "captured_fields": ["region", "crop", ...],
  "field_values": {"region": "short plain-language value you understood", ...},
  "ready": true or false
}

For every field listed in captured_fields, include a short (under 12 words)
plain-language value for it in field_values -- what you actually understood
from the conversation or spreadsheet, not a restatement of the question.
"""
```

Then update `run_chat_assistant` — replace:

```python
        reply = str(parsed.get("reply") or "").strip()
        captured = [f for f in parsed.get("captured_fields", []) if f in ALL_FIELDS]
        # Trust the model's readiness only if it is consistent with required coverage.
        ready = bool(parsed.get("ready")) and all(f in captured for f in REQUIRED_FIELDS)
        if not ready:
            ready = all(f in captured for f in REQUIRED_FIELDS)

        if not reply:
            reply = _fallback_reply(captured)

        return {"reply": reply, "captured_fields": captured, "ready": ready}

    except Exception:
        return {
            "reply": _fallback_reply([]),
            "captured_fields": [],
            "ready": False,
        }
```

with:

```python
        reply = str(parsed.get("reply") or "").strip()
        captured = [f for f in parsed.get("captured_fields", []) if f in ALL_FIELDS]
        raw_values = parsed.get("field_values") or {}
        field_values = {
            f: str(raw_values[f]).strip()
            for f in captured
            if f in raw_values and str(raw_values[f]).strip()
        }
        # Trust the model's readiness only if it is consistent with required coverage.
        ready = bool(parsed.get("ready")) and all(f in captured for f in REQUIRED_FIELDS)
        if not ready:
            ready = all(f in captured for f in REQUIRED_FIELDS)

        if not reply:
            reply = _fallback_reply(captured)

        return {
            "reply": reply,
            "captured_fields": captured,
            "field_values": field_values,
            "ready": ready,
        }

    except Exception:
        return {
            "reply": _fallback_reply([]),
            "captured_fields": [],
            "field_values": {},
            "ready": False,
        }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_chat_assistant.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Write the failing test for the `/chat` route**

In `backend/tests/test_routes.py`, add this test directly after `test_post_chat_ready_when_required_captured` (which ends around line 188 in the current file):

```python
def test_post_chat_returns_field_values(client):
    """POST /chat passes through field_values for captured fields."""
    fake = {
        "reply": "What crop is the focus?",
        "captured_fields": ["region"],
        "field_values": {"region": "Coastal Cebu, typhoon-prone"},
        "ready": False,
    }
    with patch("routes.input.run_chat_assistant", new=AsyncMock(return_value=fake)):
        response = client.post(
            "/chat",
            json={"chat_messages": [{"role": "user", "content": "We farm in coastal Cebu"}]},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["field_values"] == {"region": "Coastal Cebu, typhoon-prone"}
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd backend && pytest tests/test_routes.py::test_post_chat_returns_field_values -v`
Expected: FAIL with `KeyError: 'field_values'` — `ChatResponse` does not have that field yet, so it's absent from the JSON response body and `data["field_values"]` raises in the test.

- [ ] **Step 7: Implement passthrough in `routes/input.py`**

In `backend/routes/input.py`, replace the `ChatResponse` class:

```python
class ChatResponse(BaseModel):
    """Conversational reply plus captured-context state for the UI."""
    reply: str
    captured_fields: list[str]
    ready: bool
    missing_required: list[str]
```

with:

```python
class ChatResponse(BaseModel):
    """Conversational reply plus captured-context state for the UI."""
    reply: str
    captured_fields: list[str]
    field_values: dict[str, str] = {}
    ready: bool
    missing_required: list[str]
```

Then replace the `process_chat` body:

```python
    captured = result["captured_fields"]
    missing_required = [f for f in REQUIRED_FIELDS if f not in captured]

    return ChatResponse(
        reply=result["reply"],
        captured_fields=captured,
        ready=result["ready"],
        missing_required=missing_required,
    )
```

with:

```python
    captured = result["captured_fields"]
    missing_required = [f for f in REQUIRED_FIELDS if f not in captured]

    return ChatResponse(
        reply=result["reply"],
        captured_fields=captured,
        field_values=result.get("field_values", {}),
        ready=result["ready"],
        missing_required=missing_required,
    )
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_routes.py tests/test_chat_assistant.py -v`
Expected: PASS (all tests in both files, including the pre-existing `/chat` tests — they still pass because `field_values` defaults to `{}` and they never assert its absence)

- [ ] **Step 9: Run the full backend suite to confirm no regressions**

Run: `cd backend && pytest tests/ -v`
Expected: PASS (all tests, no failures)

- [ ] **Step 10: Commit**

```bash
git add backend/agents/chat_assistant.py backend/routes/input.py backend/tests/test_chat_assistant.py backend/tests/test_routes.py
git commit -m "feat: return captured field values from the chat assistant"
```

---

### Task 2: Frontend — plumb `field_values` through types and the API client

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Consumes: backend `ChatResponse.field_values` from Task 1.
- Produces: `ChatTurnResponse.field_values: Record<string, string>` — consumed by Task 6 (`InputPage.tsx`).

- [ ] **Step 1: Add `field_values` to `ChatTurnResponse`**

In `frontend/src/types/index.ts`, replace:

```ts
/** Response from POST /chat — the assistant's reply + captured-context state. */
export interface ChatTurnResponse {
  reply: string
  captured_fields: string[]
  ready: boolean
  missing_required: string[]
}
```

with:

```ts
/** Response from POST /chat — the assistant's reply + captured-context state. */
export interface ChatTurnResponse {
  reply: string
  captured_fields: string[]
  field_values: Record<string, string>
  ready: boolean
  missing_required: string[]
}
```

- [ ] **Step 2: Add `field_values` to the network-failure fallback in `sendChat`**

In `frontend/src/lib/api.ts`, replace:

```ts
  if (backend) return backend
  return {
    reply: "I couldn't reach the assistant — make sure the backend is running.",
    captured_fields: [],
    ready: false,
    missing_required: ['region', 'crop', 'beneficiaries'],
  }
```

with:

```ts
  if (backend) return backend
  return {
    reply: "I couldn't reach the assistant — make sure the backend is running.",
    captured_fields: [],
    field_values: {},
    ready: false,
    missing_required: ['region', 'crop', 'beneficiaries'],
  }
```

- [ ] **Step 3: Verify the build**

Run: `cd frontend && npm run build`
Expected: build succeeds with no TypeScript errors (every existing caller of `ChatTurnResponse`/`sendChat` still compiles, since `field_values` is additive).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/lib/api.ts
git commit -m "feat: plumb field_values through the chat API contract"
```

---

### Task 3: Frontend — `ConfirmationSeal` icon + stamp animation

**Files:**
- Create: `frontend/src/components/ConfirmationSeal.tsx`
- Modify: `frontend/tailwind.config.ts`

**Interfaces:**
- Produces: `export default function ConfirmationSeal({ size?: number, className?: string })` — a JSX component, drop-in compatible with how `lucide-react` icons are used elsewhere in this codebase (sized via `size`, colored via the parent's `text-*` class through `currentColor`). Tailwind animation utility class `animate-stamp`, applied in Task 4 alongside Tailwind's `motion-reduce:` variant (e.g. `motion-reduce:animate-fade-in`) so reduced-motion users get a plain fade instead of the scale+rotate stamp.

- [ ] **Step 1: Create the seal icon component**

Create `frontend/src/components/ConfirmationSeal.tsx`:

```tsx
interface ConfirmationSealProps {
  size?: number
  className?: string
}

/**
 * The one signature "confirmed" icon for this feature — a circular seal/stamp,
 * not a generic checkmark. Always paired with text per the accessibility floor;
 * never used as the sole signal of state. Colors via `currentColor`, so it
 * inherits whatever text-color class wraps it (gold on dark backgrounds,
 * forest on white cards), matching how lucide-react icons are used elsewhere.
 */
export default function ConfirmationSeal({ size = 14, className = '' }: ConfirmationSealProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeDasharray="2.2 2.6"
        opacity="0.55"
      />
      <path
        d="M8 12.5l2.5 2.5L16 9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
```

- [ ] **Step 2: Add the `stamp` keyframe and animation**

In `frontend/tailwind.config.ts`, inside `keyframes`, add a `stamp` entry directly after the `sparkle` entry (currently the last one, ending around line 104):

```ts
        sparkle: {
          '0%, 100%': { opacity: '0', transform: 'scale(0) rotate(0deg)' },
          '50%': { opacity: '1', transform: 'scale(1) rotate(180deg)' },
        },
        stamp: {
          '0%': { opacity: '0', transform: 'scale(0.6) rotate(-8deg)' },
          '60%': { opacity: '1', transform: 'scale(1.08) rotate(2deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
```

Inside `animation`, add a matching entry directly after `sparkle` (currently the last one, ending around line 115):

```ts
        sparkle: 'sparkle 1.5s ease-in-out infinite',
        stamp: 'stamp 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
```

- [ ] **Step 3: Verify the build**

Run: `cd frontend && npm run build`
Expected: build succeeds (the new component isn't imported anywhere yet, so this just confirms it compiles standalone and the Tailwind config is still valid JSON/TS).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ConfirmationSeal.tsx frontend/tailwind.config.ts
git commit -m "feat: add ConfirmationSeal icon and stamp animation primitive"
```

---

### Task 4: Frontend — upgrade `ContextStatus.tsx`

**Files:**
- Modify: `frontend/src/components/ContextStatus.tsx`

**Interfaces:**
- Consumes: `ConfirmationSeal` from Task 3; `ContextField.detail` populated with the real captured value (wired in Task 6 — this task only changes how `ContextStatus` *renders* `detail`, it does not change what populates it).
- Produces: `ContextStatusProps` gains `onReview: () => void` — consumed by Task 6 (`InputPage.tsx` passes its review-navigation handler here).

- [ ] **Step 1: Replace the full file**

Replace the entire contents of `frontend/src/components/ContextStatus.tsx` with:

```tsx
import { Minus } from 'lucide-react'
import type { ContextField, ContextFieldKey } from '../types'
import ConfirmationSeal from './ConfirmationSeal'

interface ContextStatusProps {
  fields: ContextField[]
  onReview: () => void
}

const WHY_TEXT: Record<ContextFieldKey, string> = {
  region: 'Shapes the climate and infrastructure assumptions in your program.',
  crop: 'Determines which interventions are relevant at all.',
  beneficiaries: 'Sets the scale the program is designed for.',
  budget: 'Affects how many rollout phases we can recommend.',
  staff: 'Affects how many rollout phases your team can realistically run.',
}

/**
 * Right panel — what we've picked up from chat + spreadsheet, in plain
 * language. Once every required field is captured, this becomes the entry
 * point into the Review Context screen via the footer button.
 */
export default function ContextStatus({ fields, onReview }: ContextStatusProps) {
  const missingRequired = fields
    .filter((f) => f.required && !f.captured)
    .map((f) => f.label.toLowerCase())

  const capturedCount = fields.filter((f) => f.captured).length
  const totalCount = fields.length
  const progress = (capturedCount / totalCount) * 100
  const ready = missingRequired.length === 0

  return (
    <div className="flex h-full flex-col">
      <p className="mb-4 text-[13px] leading-relaxed text-secondary">
        What we've picked up from your data and chat.
      </p>

      {/* Progress bar */}
      <div className="mb-4 overflow-hidden rounded-full bg-canvas/70">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-leaf to-forest transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="flex-1 space-y-2">
        {fields.map((field, index) => (
          <li
            key={field.key}
            className={
              field.captured
                ? 'group flex items-center gap-3 rounded-xl border border-leaf/40 bg-leaf-soft px-3 py-2.5 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md animate-bounce-in'
                : 'group flex items-center gap-3 rounded-xl border border-hairline bg-canvas/50 px-3 py-2.5 transition-all duration-300 hover:border-leaf/30 hover:bg-canvas animate-slide-in-up'
            }
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <span
              className={
                field.captured
                  ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest text-white shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow'
                  : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hairline text-secondary transition-all duration-300 group-hover:border-leaf group-hover:text-leaf'
              }
            >
              {field.captured ? (
                <ConfirmationSeal size={13} className="animate-bounce-in" />
              ) : (
                <Minus size={14} strokeWidth={2} />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div
                className={
                  field.captured
                    ? 'text-[14px] font-medium text-primary transition-colors duration-300'
                    : 'text-[14px] text-secondary transition-colors duration-300 group-hover:text-primary'
                }
              >
                {field.label}
              </div>
              {field.detail ? (
                <div className="text-[12px] text-forest transition-all duration-300 group-hover:text-forest-deep">
                  {field.detail}
                </div>
              ) : (
                <div className="text-[12px] text-secondary">{WHY_TEXT[field.key]}</div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!ready ? (
        <p className="mt-5 rounded-xl border border-hairline bg-canvas/50 px-3 py-2.5 text-center text-[12px] text-secondary animate-fade-in">
          Still needed: {missingRequired.join(', ')}. The assistant will ask in chat.
        </p>
      ) : (
        <button
          type="button"
          onClick={onReview}
          className="mt-5 flex items-center justify-center gap-1.5 rounded-xl border border-leaf/40 bg-leaf-soft px-3 py-2.5 text-center text-[12px] font-medium text-forest transition-all duration-300 hover:scale-[1.02] hover:bg-leaf/20 animate-stamp motion-reduce:animate-fade-in"
        >
          <ConfirmationSeal size={14} />
          Review & generate
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify the build**

Run: `cd frontend && npm run build`
Expected: TypeScript error — `Property 'onReview' is missing in type` wherever `<ContextStatus fields={fields} />` is currently called in `InputPage.tsx`. This is expected; Task 6 fixes the caller. Confirm the error is exactly this (a missing-prop error on `ContextStatus`, not a syntax error in this file).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ContextStatus.tsx
git commit -m "feat: show captured values and add Review & generate action to Context Status"
```

---

### Task 5: Frontend — always-visible Generate button in `ChatBox.tsx`

**Files:**
- Modify: `frontend/src/components/ChatBox.tsx`

**Interfaces:**
- Consumes: `missing_required: string[]` (already exists on `ChatTurnResponse`, predates this plan).
- Produces: `ChatBoxProps` drops `canGenerate: boolean` and `running: boolean`, adds `ready: boolean` and `missingRequired: string[]` — consumed by Task 6 (`InputPage.tsx`). `running` is removed outright (not just hardcoded) because Generate now only navigates synchronously to `/review` — the async "starting the agents" state this used to show no longer happens on this page at all (it moves to `ReviewContextPage` in Task 7, which has no Generate-button "running" UI of its own).

- [ ] **Step 1: Update the props interface and add the label helper**

In `frontend/src/components/ChatBox.tsx`, replace:

```tsx
interface ChatBoxProps {
  messages: ChatMessage[]
  attachment: Attachment | null
  canGenerate: boolean
  running: boolean
  onSend: (text: string) => void
  onFile: (file: File) => void
  onPasteTable: (text: string) => void
  onGenerate: () => void
  onRemoveAttachment: () => void
}
```

with:

```tsx
interface ChatBoxProps {
  messages: ChatMessage[]
  attachment: Attachment | null
  ready: boolean
  missingRequired: string[]
  onSend: (text: string) => void
  onFile: (file: File) => void
  onPasteTable: (text: string) => void
  onGenerate: () => void
  onRemoveAttachment: () => void
}

/** "Add region, crop & beneficiaries to continue" — joins missing required fields. */
function formatMissingMessage(missing: string[]): string {
  if (missing.length === 0) return 'Add more context to continue'
  if (missing.length === 1) return `Add ${missing[0]} to continue`
  return `Add ${missing.slice(0, -1).join(', ')} & ${missing[missing.length - 1]} to continue`
}
```

- [ ] **Step 2: Update the function signature and remove the now-unused `Loader2` import**

Replace the import line:

```tsx
import { Paperclip, ArrowUp, Sprout, ArrowRight, Loader2 } from 'lucide-react'
```

with:

```tsx
import { Paperclip, ArrowUp, Sprout, ArrowRight } from 'lucide-react'
```

Replace:

```tsx
export default function ChatBox({
  messages,
  attachment,
  canGenerate,
  running,
  onSend,
  onFile,
  onPasteTable,
  onGenerate,
  onRemoveAttachment,
}: ChatBoxProps) {
```

with:

```tsx
export default function ChatBox({
  messages,
  attachment,
  ready,
  missingRequired,
  onSend,
  onFile,
  onPasteTable,
  onGenerate,
  onRemoveAttachment,
}: ChatBoxProps) {
```

- [ ] **Step 3: Replace the Generate button block**

Replace:

```tsx
        {canGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={running}
            className={
              running
                ? 'flex w-full cursor-wait items-center justify-center gap-2 rounded-2xl border border-hairline bg-canvas/60 px-4 py-3 text-[14px] font-semibold text-secondary'
                : 'glow-on-hover group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-forest to-forest-deep px-4 py-3 text-[14px] font-semibold text-white shadow-card transition-all duration-300 hover:scale-[1.02] hover:shadow-glow active:scale-95 animate-slide-in-up'
            }
          >
            {running ? (
              <>
                <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
                Starting the agents…
              </>
            ) : (
              <>
                <Sprout size={16} strokeWidth={1.8} className="text-leaf-bright" />
                Generate program
                <ArrowRight
                  size={16}
                  strokeWidth={1.8}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </>
            )}
          </button>
        )}
```

with:

```tsx
        <button
          type="button"
          onClick={onGenerate}
          disabled={!ready}
          className={
            ready
              ? 'glow-on-hover group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-forest to-forest-deep px-4 py-3 text-[14px] font-semibold text-white shadow-card transition-all duration-300 hover:scale-[1.02] hover:shadow-glow active:scale-95 animate-slide-in-up'
              : 'flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-hairline bg-canvas/40 px-4 py-3 text-[14px] font-medium text-secondary'
          }
        >
          {ready ? (
            <>
              <Sprout size={16} strokeWidth={1.8} className="text-leaf-bright" />
              Review your context
              <ArrowRight
                size={16}
                strokeWidth={1.8}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </>
          ) : (
            formatMissingMessage(missingRequired)
          )}
        </button>
```

- [ ] **Step 4: Verify the build**

Run: `cd frontend && npm run build`
Expected: TypeScript error on the existing `<ChatBox canGenerate={canGenerate} running={running} ... />` call in `InputPage.tsx` (`canGenerate`/`running` no longer exist on `ChatBoxProps`, `ready`/`missingRequired` are missing). Expected; Task 6 fixes the caller.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ChatBox.tsx
git commit -m "feat: always render the Generate button with plain-language missing-field state"
```

---

### Task 6: Frontend — fix gating and wire navigation state in `InputPage.tsx`

**Files:**
- Modify: `frontend/src/pages/InputPage.tsx`
- Modify: `frontend/src/types/index.ts`

**Interfaces:**
- Consumes: `ContextStatus`'s `onReview` prop (Task 4), `ChatBox`'s `ready`/`missingRequired` props (Task 5), `ChatTurnResponse.field_values` (Task 2).
- Produces: `ReviewNavState` (new exported type in `types/index.ts`) — the exact shape passed via React Router's `navigate(path, { state })` between `/` and `/review`. Consumed by Task 7 (`ReviewContextPage.tsx`).

- [ ] **Step 1: Add the `ReviewNavState` type**

In `frontend/src/types/index.ts`, add this directly after the `ContextField` interface (the last entry in the file):

```ts

/** Carried via React Router navigation `state` between `/` and `/review` — keeps chat history and captured context alive across that round trip without a global store. */
export interface ReviewNavState {
  messages: ChatMessage[]
  preview: UploadPreview | null
  captured: string[]
  fieldValues: Record<string, string>
  missingRequired: string[]
  ready: boolean
}
```

- [ ] **Step 2: Read incoming navigation state and initialize from it**

In `frontend/src/pages/InputPage.tsx`, replace the import line:

```tsx
import { Link, useNavigate } from 'react-router-dom'
```

with:

```tsx
import { Link, useLocation, useNavigate } from 'react-router-dom'
```

and replace the type import:

```tsx
import type {
  ChatMessage,
  ChipState,
  ContextField,
  ContextFieldKey,
  ContextPayload,
  UploadPreview,
} from '../types'
```

with:

```tsx
import type {
  ChatMessage,
  ChipState,
  ContextField,
  ContextFieldKey,
  ContextPayload,
  ReviewNavState,
  UploadPreview,
} from '../types'
```

Then replace the component's state initialization:

```tsx
export default function InputPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [preview, setPreview] = useState<UploadPreview | null>(null)
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [captured, setCaptured] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [running, setRunning] = useState(false)
  const [showExplainer, setShowExplainer] = useState(
    () => localStorage.getItem('anikonsulta:seen-explainer') !== '1',
  )
```

with:

```tsx
export default function InputPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const navState = location.state as ReviewNavState | null

  const [messages, setMessages] = useState<ChatMessage[]>(navState?.messages ?? [INITIAL_MESSAGE])
  const [preview, setPreview] = useState<UploadPreview | null>(navState?.preview ?? null)
  const [attachment, setAttachment] = useState<Attachment | null>(
    navState?.preview ? { state: 'parsed', preview: navState.preview } : null,
  )
  const [captured, setCaptured] = useState<string[]>(navState?.captured ?? [])
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    navState?.fieldValues ?? {},
  )
  const [missingRequired, setMissingRequired] = useState<string[]>(
    navState?.missingRequired ?? ['region', 'crop', 'beneficiaries'],
  )
  const [ready, setReady] = useState(navState?.ready ?? false)
  const [showExplainer, setShowExplainer] = useState(
    () => localStorage.getItem('anikonsulta:seen-explainer') !== '1',
  )
```

Note: the pre-existing `const [running, setRunning] = useState(false)` line is deleted, not kept — Step 6 below removes its only two remaining readers/writers (`handleGenerate` and the `ChatBox` call site), so it would otherwise be dead state.

- [ ] **Step 3: Update `runChatTurn` to capture values and missing-required**

Replace:

```tsx
  /** Send one chat turn and fold the assistant's reply + state into the UI. */
  async function runChatTurn(history: ChatMessage[], current: UploadPreview | null) {
    const res = await sendChat(history, current)
    setMessages((prev) => [...prev, { role: 'system', content: res.reply }])
    setCaptured(res.captured_fields)
    setReady(res.ready)
  }
```

with:

```tsx
  /** Send one chat turn and fold the assistant's reply + state into the UI. */
  async function runChatTurn(history: ChatMessage[], current: UploadPreview | null) {
    const res = await sendChat(history, current)
    setMessages((prev) => [...prev, { role: 'system', content: res.reply }])
    setCaptured(res.captured_fields)
    setFieldValues(res.field_values)
    setMissingRequired(res.missing_required)
    setReady(res.ready)
  }
```

- [ ] **Step 4: Update the `fields` memo to show real captured values**

Replace:

```tsx
  const fields: ContextField[] = useMemo(
    () =>
      FIELD_CONFIG.map((cfg) => ({
        key: cfg.key,
        label: cfg.label,
        required: cfg.required,
        captured: captured.includes(cfg.key),
        detail: captured.includes(cfg.key) ? 'captured' : undefined,
      })),
    [captured],
  )
```

with:

```tsx
  const fields: ContextField[] = useMemo(
    () =>
      FIELD_CONFIG.map((cfg) => ({
        key: cfg.key,
        label: cfg.label,
        required: cfg.required,
        captured: captured.includes(cfg.key),
        detail: fieldValues[cfg.key],
      })),
    [captured, fieldValues],
  )
```

- [ ] **Step 5: Replace `canGenerate`/`handleGenerate` with the review-navigation handler**

Replace:

```tsx
  const canGenerate = ready || preview !== null

  async function handleGenerate() {
    if (!canGenerate || running) return
    setRunning(true)
    const payload: ContextPayload = {
      run_id: crypto.randomUUID(),
      excel_data: preview?.excelData ?? [],
      chat_messages: messages,
    }
    const id = await startRun(payload)
    if (id) {
      navigate(`/status?run=${encodeURIComponent(id)}`)
    } else {
      setRunning(false)
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: "I couldn't start the run — make sure the backend is running." },
      ])
    }
  }
```

with:

```tsx
  function goToReview() {
    if (!ready) return
    const reviewState: ReviewNavState = {
      messages,
      preview,
      captured,
      fieldValues,
      missingRequired,
      ready,
    }
    navigate('/review', { state: reviewState })
  }
```

- [ ] **Step 6: Remove the now-unused `startRun`/`ContextPayload` import**

Replace the import line:

```tsx
import { sendChat, startRun, uploadExcel } from '../lib/api'
```

with:

```tsx
import { sendChat, uploadExcel } from '../lib/api'
```

Remove the now-unused `ContextPayload` entry from the type import block (already updated in Step 2 above to include `ReviewNavState`). `InputPage.tsx` no longer constructs a `ContextPayload` directly — that responsibility moves to `ReviewContextPage.tsx` in Task 7. The import block from Step 2 becomes:

```tsx
import type {
  ChatMessage,
  ChipState,
  ContextField,
  ContextFieldKey,
  ReviewNavState,
  UploadPreview,
} from '../types'
```

- [ ] **Step 7: Update the `ChatBox` and `ContextStatus` call sites**

Replace:

```tsx
  const chat = (
    <ChatBox
      messages={messages}
      attachment={attachment}
      canGenerate={canGenerate}
      running={running}
      onSend={handleSend}
      onFile={handleFile}
      onPasteTable={handlePasteTable}
      onGenerate={handleGenerate}
      onRemoveAttachment={() => {
        setAttachment(null)
        setPreview(null)
      }}
    />
  )
  const context = <ContextStatus fields={fields} />
```

with:

```tsx
  const chat = (
    <ChatBox
      messages={messages}
      attachment={attachment}
      ready={ready}
      missingRequired={missingRequired}
      onSend={handleSend}
      onFile={handleFile}
      onPasteTable={handlePasteTable}
      onGenerate={goToReview}
      onRemoveAttachment={() => {
        setAttachment(null)
        setPreview(null)
      }}
    />
  )
  const context = <ContextStatus fields={fields} onReview={goToReview} />
```

- [ ] **Step 8: Verify the build**

Run: `cd frontend && npm run build`
Expected: build succeeds with no TypeScript errors. This also resolves the two expected errors flagged in Task 4 Step 2 and Task 5 Step 4.

- [ ] **Step 9: Manual verification**

Run `cd backend && uvicorn main:app --reload` in one terminal and `cd frontend && npm run dev` in another. In the browser:
1. Upload an Excel file with columns that contain no usable region/crop/beneficiary data (e.g. a sheet of random numbers). Confirm the Generate button shows disabled, muted styling with text like "Add region, crop & beneficiaries to continue" — it must NOT let you proceed just because a file was uploaded.
2. Chat until the assistant captures all 3 required fields. Confirm the button becomes the green "Review your context" button, and the Context Status panel's footer becomes a clickable "Review & generate" button with the seal icon and the stamp animation playing once.
3. Confirm each captured field in Context Status now shows the real extracted value under its label (e.g. "Coastal Cebu, typhoon-prone"), not the literal word "captured".

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/InputPage.tsx frontend/src/types/index.ts
git commit -m "fix: close the required-field gating bypass and wire Review Context navigation"
```

---

### Task 7: Frontend — new `ReviewContextPage` and route

**Files:**
- Create: `frontend/src/pages/ReviewContextPage.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `ReviewNavState` (Task 6), `ConfirmationSeal` (Task 3), `startRun` (`frontend/src/lib/api.ts`, pre-existing, signature `(payload: ContextPayload) => Promise<string | null>`).

- [ ] **Step 1: Create the Review Context page**

Create `frontend/src/pages/ReviewContextPage.tsx`:

```tsx
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Sprout } from 'lucide-react'
import type { ContextPayload, ReviewNavState } from '../types'
import ConfirmationSeal from '../components/ConfirmationSeal'
import { startRun } from '../lib/api'

const FIELD_LABELS: Record<string, string> = {
  region: 'Region & conditions',
  crop: 'Crop / activity',
  beneficiaries: 'Beneficiaries',
  budget: 'Budget',
  staff: 'Staff',
}
const FIELD_ORDER = ['region', 'crop', 'beneficiaries', 'budget', 'staff']

/**
 * The pause-before-the-pipeline-runs checkpoint: shows every context field the
 * AI has captured, in plain language, before any agent fires. Reached only via
 * navigation `state` from InputPage — a direct/bookmarked visit has no state to
 * show, so it bounces back to the Input page.
 */
export default function ReviewContextPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as ReviewNavState | null

  useEffect(() => {
    if (!state) navigate('/', { replace: true })
  }, [state, navigate])

  if (!state) return null

  async function handleConfirmGenerate() {
    const payload: ContextPayload = {
      run_id: crypto.randomUUID(),
      excel_data: state!.preview?.excelData ?? [],
      chat_messages: state!.messages,
    }
    const id = await startRun(payload)
    if (id) {
      navigate(`/status?run=${encodeURIComponent(id)}`)
    } else {
      navigate('/', { state })
    }
  }

  function handleAddMoreInfo() {
    navigate('/', { state })
  }

  return (
    <div className="min-h-screen bg-canvas pb-28">
      <main className="mx-auto w-full max-w-[640px] px-4 py-12 sm:px-6">
        <h1 className="font-display text-[28px] font-semibold text-primary animate-rise">
          Here's everything we'll use to build your program
        </h1>
        <p className="mt-2 text-[14px] text-secondary animate-rise" style={{ animationDelay: '0.08s' }}>
          Check that this looks right before the agents start working.
        </p>

        <ul className="mt-6 space-y-3">
          {FIELD_ORDER.map((key, i) => {
            const value = state.fieldValues[key]
            const captured = state.captured.includes(key)
            return (
              <li
                key={key}
                className="card-surface flex items-start gap-3 rounded-card border border-hairline p-4 animate-rise"
                style={{ animationDelay: `${(i + 2) * 0.08}s` }}
              >
                <span
                  className={
                    captured
                      ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-white'
                      : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline text-secondary'
                  }
                >
                  <ConfirmationSeal size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium text-primary">{FIELD_LABELS[key]}</div>
                  <div className="text-[13px] text-secondary">
                    {captured ? value : 'Not provided — program will use general defaults.'}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-canvas/95 px-4 py-4 backdrop-blur-sm sm:px-6">
          <div className="mx-auto flex w-full max-w-[640px] flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={handleAddMoreInfo}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-hairline bg-panel px-4 py-3 text-[14px] font-semibold text-primary transition-all duration-300 hover:border-leaf hover:bg-leaf-soft"
            >
              <ArrowLeft size={16} strokeWidth={1.8} />
              Add more info
            </button>
            <button
              type="button"
              onClick={handleConfirmGenerate}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-forest to-forest-deep px-4 py-3 text-[14px] font-semibold text-white shadow-card transition-all duration-300 hover:scale-[1.02] hover:shadow-glow active:scale-95"
            >
              <Sprout size={16} strokeWidth={1.8} className="text-leaf-bright" />
              Looks right — generate
              <ArrowRight size={16} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Add the route**

In `frontend/src/App.tsx`, replace:

```tsx
import { Routes, Route } from 'react-router-dom'
import InputPage from './pages/InputPage'
import AgentStatusPage from './pages/AgentStatusPage'
import OutputPage from './pages/OutputPage'
import SourcesPage from './pages/SourcesPage'
import CompareView from './components/CompareView'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<InputPage />} />
      <Route path="/status" element={<AgentStatusPage />} />
      <Route path="/output" element={<OutputPage />} />
      <Route path="/sources" element={<SourcesPage />} />
      <Route path="/compare" element={<CompareView />} />
    </Routes>
  )
}
```

with:

```tsx
import { Routes, Route } from 'react-router-dom'
import InputPage from './pages/InputPage'
import ReviewContextPage from './pages/ReviewContextPage'
import AgentStatusPage from './pages/AgentStatusPage'
import OutputPage from './pages/OutputPage'
import SourcesPage from './pages/SourcesPage'
import CompareView from './components/CompareView'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<InputPage />} />
      <Route path="/review" element={<ReviewContextPage />} />
      <Route path="/status" element={<AgentStatusPage />} />
      <Route path="/output" element={<OutputPage />} />
      <Route path="/sources" element={<SourcesPage />} />
      <Route path="/compare" element={<CompareView />} />
    </Routes>
  )
}
```

- [ ] **Step 3: Verify the build**

Run: `cd frontend && npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4: Manual end-to-end verification**

With both servers running (per Task 6 Step 9):
1. Complete the chat flow to `ready`, click "Review your context" (or the Context Status panel's "Review & generate"). Confirm you land on `/review` showing all 5 fields, with the 3 required ones showing real captured values and any uncaptured optional ones showing "Not provided — program will use general defaults."
2. Click "Add more info". Confirm you return to `/` with your chat history, uploaded spreadsheet chip, and Context Status all exactly as you left them — nothing resets.
3. Navigate back to `/review`, then click "Looks right — generate". Confirm a run actually starts and you land on `/status?run=...` with agents progressing, same as the pipeline did before this change.
4. Navigate directly to `http://localhost:5173/review` in a fresh tab (no prior state). Confirm it immediately redirects to `/`, rather than showing a broken/empty screen.
5. In browser dev tools, enable "prefers reduced motion" (or your OS's reduce-motion setting) and re-trigger the ready state in Context Status. Confirm the seal/button fades in rather than performing the scale+rotate stamp.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ReviewContextPage.tsx frontend/src/App.tsx
git commit -m "feat: add the Review Context screen as a pipeline checkpoint"
```

---

## Final Verification

After all 7 tasks are complete:

```bash
cd backend && pytest tests/ -v
cd frontend && npm run build
```

Both must succeed with zero failures. Then repeat the full manual walkthrough from Task 7 Step 4 once more end-to-end, plus the Task 6 Step 9 checks, as a final regression pass before considering this plan done.
