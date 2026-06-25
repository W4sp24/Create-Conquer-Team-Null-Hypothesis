# ChatBox Auto-Scroll Plan

## Overview

The chatbot conversation list in `ChatBox.tsx` does not automatically scroll to the bottom when new messages arrive. The goal is to ensure the latest message is always visible after each new message is added.

---

## Sub-Tasks

### 1. Add auto-scroll to the message thread

**Intent**
Scroll the message thread container to its bottom whenever the `messages` array changes, so the user always sees the most recent message without manually scrolling.

**Expected Outcomes**
- Every time a new message is appended, the thread scrolls smoothly to the bottom.
- Initial render with existing messages also starts scrolled to the bottom.

**Todo List**
1. Add a `useRef` pointing to the scrollable message thread `<div>` (the one at line 111 with class `flex-1 min-h-0 … overflow-y-auto`).
2. Add a `useEffect` that depends on `messages`. Inside it, scroll the ref element to its `scrollHeight` (smooth behavior).
3. Also add a sentinel `<div ref={bottomRef} />` at the end of the message list and call `bottomRef.current?.scrollIntoView({ behavior: 'smooth' })` — simpler and more reliable alternative to scrollHeight.

**Relevant Context**
- File: [`frontend/src/components/ChatBox.tsx`](frontend/src/components/ChatBox.tsx)
- Scrollable container: `<div className="flex-1 min-h-0 space-y-5 overflow-y-auto pr-1 smooth-scroll">` at line 111
- The `messages` prop drives the list; a `useEffect([messages])` is the right hook.
- `useRef` and `useEffect` are already importable from `react` — just need to add `useEffect` to the existing import.

**Status**
[ ] pending
