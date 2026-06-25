# Chatbot Improvement Plan

## Top-Level Overview

**Goal:** Fix three specific issues with the chatbot and improve the AI's context handling quality.

1. **Duplicate question bug** — The LLM repeats the same question because the transcript is sent as a flat string in a single user message, breaking turn boundaries. Fix by passing a proper multi-turn messages array to the Groq API.
2. **Conversation resets on reload** — Chat state lives only in React `useState`. Fix by persisting the conversation in `localStorage` on the frontend — no backend storage needed. It survives reloads and only clears when the user presses Reset.
3. **Better AI context handling** — Strengthen the system prompt so the model never re-asks for a field it already has, and clean up the redundant readiness logic.

**Scope:** Backend changes (multi-turn messages, improved prompt) + minimal frontend wiring (`localStorage` persistence and a reset button). No database, no new backend endpoints.

**Non-goals:**
- No server-side conversation storage.
- No per-user sessions or authentication.
- No changes to the pipeline agents (data_analyst, synthesizer, etc.).
- No streaming chat responses.

---

## Sub-Tasks

---

### Sub-Task 1 — Fix the Duplicate Question Bug (Backend)

**Intent**
`run_chat_assistant` in `agents/chat_assistant.py` squashes the full conversation into a flat `"role: content\n..."` string and sends it as a single user message. The model sees the last assistant reply as part of the user context, loses track of turn order, and sometimes re-asks the same question. Fix by passing a proper multi-turn `[{role, content}]` array to the Groq API, which it natively supports.

**Expected Outcomes**
- `_call_groq` in `agents/base.py` can accept a pre-built messages list directly.
- `run_chat_assistant` maps `role: "system"` messages (assistant replies stored by the frontend) → `{"role": "assistant"}` and `role: "user"` → `{"role": "user"}`, then appends the spreadsheet summary as the final user turn.
- The model no longer echoes or repeats its previous reply.

**Todo List**
1. In `agents/base.py`, add a new function `call_llm_chat(provider, model, messages: list[dict], system_prompt: str)` that accepts a pre-built messages array. For Groq, prepend the system message and call `client.chat.completions.create(messages=messages)` directly. Include the same 2-attempt retry.
2. In `agents/chat_assistant.py`, replace the flat `transcript` string with a multi-turn messages list:
   - Map each `ChatMessage` where `role == "user"` → `{"role": "user", "content": m.content}`
   - Map each `ChatMessage` where `role == "system"` (assistant replies) → `{"role": "assistant", "content": m.content}`
   - Append the spreadsheet summary + "respond to the latest user message" instruction as the final `{"role": "user"}` entry.
3. Call `call_llm_chat` instead of `call_llm` inside `run_chat_assistant`.

**Relevant Context**
- `backend/agents/base.py` — `_call_groq`, `call_llm`
- `backend/agents/chat_assistant.py` — `run_chat_assistant`, lines 113–129

**Status:** [ ] pending

---

### Sub-Task 2 — Improve System Prompt & Context Awareness (Backend)

**Intent**
The `SYSTEM_PROMPT` doesn't explicitly forbid re-asking for already-captured fields, and the readiness logic has a redundant double-check that undermines trust in the model's `ready` flag.

**Expected Outcomes**
- System prompt contains an explicit rule: never ask again for a field already in `captured_fields`.
- Each user prompt turn includes a "Already captured: [...]" line so the model has a concrete anchor.
- The redundant `if not ready:` override block is removed. Readiness is determined by one clean check: `ready = all(f in captured for f in REQUIRED_FIELDS)`.
- The model gives a warm confirmation when all fields are in and stops asking questions.

**Todo List**
1. In `agents/chat_assistant.py`, update `SYSTEM_PROMPT` to add the rule: "Never ask for a field that is already listed in captured_fields. If region is already captured, do not ask about it again. When all required fields are captured, give a warm confirmation and set ready=true."
2. Update the user prompt (the final user message appended in Sub-Task 1) to prefix with a "Already captured: {comma-separated list or 'none yet'}" line derived from the conversation state — this means passing `captured_fields` into `run_chat_assistant`.
3. Update the signature of `run_chat_assistant` to accept `previously_captured: list[str] = []`.
4. Update `routes/input.py` `POST /chat` to pass `request.captured_fields` (add `captured_fields: list[str] = []` to `ChatRequest`) into `run_chat_assistant`.
5. Remove the double `ready` check at lines 143–145 of `chat_assistant.py`. Replace with: `ready = all(f in captured for f in REQUIRED_FIELDS)`.

**Relevant Context**
- `backend/agents/chat_assistant.py` — `SYSTEM_PROMPT`, `run_chat_assistant` lines 113–155
- `backend/routes/input.py` — `ChatRequest`, `POST /chat` handler

**Status:** [ ] pending

---

### Sub-Task 3 — Persist Chat in localStorage + Add Reset Button (Frontend)

**Intent**
The conversation lives only in React `useState` and is lost on page reload. Instead, persist the full chat state to `localStorage` so it survives reloads automatically. Add a Reset button in the chat panel header that clears `localStorage` and resets state to the initial greeting — this is the only way the conversation clears.

**Expected Outcomes**
- On page load, the app restores messages, captured fields, field values, and ready state from `localStorage` if present.
- On every state change, the app writes the current chat state to `localStorage`.
- A "Reset" button appears in the Chat panel header. Clicking it clears `localStorage` and resets the chat to the initial greeting.
- The backend receives `captured_fields` from the frontend so Sub-Task 2's prompt enrichment works correctly.

**Todo List**
1. In `frontend/src/pages/InputPage.tsx`, create a `useChatPersistence` hook (or inline logic) that:
   - On mount: reads `anikonsulta:chat-state` from `localStorage` and hydrates `messages`, `captured`, `fieldValues`, `missingRequired`, `ready`.
   - On every state change: writes the current state back to `localStorage`.
2. Add a `handleReset()` function that removes `anikonsulta:chat-state` from `localStorage` and resets all chat state to initial values (initial greeting message, empty captured, etc.).
3. Pass `handleReset` down to `ChatBox` as a new `onReset` prop.
4. In `frontend/src/components/ChatBox.tsx`, add a small Reset button (e.g. a `RotateCcw` icon from lucide-react) to the top-right of the chat container. It calls `onReset`.
5. In `frontend/src/lib/api.ts`, update `sendChat` to include `captured_fields` in the request body (mapping from the caller's current `captured` state).
6. In `frontend/src/pages/InputPage.tsx`, pass the current `captured` array into `sendChat` inside `runChatTurn`.

**Relevant Context**
- `frontend/src/pages/InputPage.tsx` — `InputPage`, state declarations, `runChatTurn`
- `frontend/src/components/ChatBox.tsx` — `ChatBoxProps`, the chat container render
- `frontend/src/lib/api.ts` — `sendChat` function

**Status:** [ ] pending

---

## Implementation Order

```
Sub-Task 1  (fix multi-turn messages — backend only)
    ↓
Sub-Task 2  (better prompt + captured_fields — backend + small route change)
    ↓
Sub-Task 3  (localStorage persistence + reset button — frontend)
```

Sub-Tasks 1 and 2 are backend-only and independent of each other but should be done in order (1 first, since 2 builds on the improved message handling). Sub-Task 3 is frontend and depends on the `captured_fields` field added in Sub-Task 2's route contract.
