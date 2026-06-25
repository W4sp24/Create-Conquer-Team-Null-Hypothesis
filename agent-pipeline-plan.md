# Agent Pipeline Node UI Plan

## Overview

Replace the current flat `AgentCard` card list on `AgentStatusPage` with a vertical node pipeline
visualization that matches the dark forest-green theme of the app. Each agent is a circular node
connected by a vertical line. The connector animates based on pipeline state. Each node shows only
the agent name and a status icon — minimal and clean.

The page background is dark forest (`#1A3320`) with floating particles and ambient green glows —
the pipeline sits on top of this as a centered, glowing, glass-feel column.

**Scope:** Frontend only — `AgentStatusPage.tsx`, `AgentCard.tsx`, new `PipelineView.tsx`,
`tailwind.config.ts` (one new keyframe).

---

## Visual Design

### Layout
- Centered column, max-width `480px`, sits inside the existing `max-w-[920px]` main area.
- Each agent row: circular node (left) + name & status pill (right), connected by a vertical line.
- The whole pipeline has a subtle glass card backing:
  `bg-white/5 backdrop-blur-sm border border-white/10 rounded-card px-8 py-8`
  (matches the `.glass` component pattern already in the theme).

### Node circle (40×40px)
| Status | Circle style |
|---|---|
| `pending` | `border-2 border-white/20 bg-white/5` — ghost ring on dark bg |
| `running` | `bg-leaf/20 border-2 border-leaf shadow-glow animate-pulse-glow` — glowing green ring |
| `done` | `bg-leaf border-0 shadow-glow` — solid leaf green with glow |
| `error` | `bg-red-500/20 border-2 border-red-400` |

### Icon inside node
| Status | Icon |
|---|---|
| `pending` | `Circle` (outline, 14px, `text-white/30`) |
| `running` | `Loader2` (18px, `text-leaf animate-spin`) |
| `done` | `Check` (18px, `text-white`, stroke 2.5) |
| `error` | `AlertTriangle` (16px, `text-red-400`) |

### Agent name + status text (right of node)
- Name: `font-display text-[17px] font-semibold text-mist` (light on dark bg)
- Status text (no pill — just a small muted label below the name):
  - pending: `text-[12px] text-mist-muted`
  - running: `text-[12px] text-leaf animate-pulse` (pulsing green text)
  - done: `text-[12px] text-leaf`
  - error: `text-[12px] text-red-400`

### Connector line (between nodes, 52px tall, 2px wide, centered under circle)
| Above-node status | Line style |
|---|---|
| `done` | Solid `bg-leaf` — pipeline has fully passed through |
| `running` | `bg-white/10` base with a travelling leaf-green band (new `travel` keyframe, see below) |
| `pending` | `bg-white/10` — dim hairline on dark |
| `error` | `bg-red-400/30` |

### Entry animation
- Each node row enters with `animate-rise` staggered by `index * 0.1s`, matching the rest of the app.

---

## New Keyframe: `travel`

A leaf-green band (30% height) scrolls top-to-bottom continuously over the connector line when
the agent above it is `running`. Added to `tailwind.config.ts`:

```
travel: {
  '0%':   { transform: 'translateY(-100%)' },
  '100%': { transform: 'translateY(100%)' },
}
animation: 'travel 1s linear infinite'
```

The connector uses a `relative overflow-hidden` wrapper with an absolutely-positioned
`h-1/3 w-full bg-leaf/60 rounded-full` inner div running the `animate-travel` animation.

---

## Sub-Tasks

### Sub-Task 1 — Add `travel` keyframe to `tailwind.config.ts`

**Intent**  
Register the new `travel` keyframe and `animate-travel` animation class so it can be used in the
connector line component.

**Expected Outcomes**  
- `animate-travel` is a valid Tailwind class that runs the travel animation `1s linear infinite`.

**Todo List**  
1. In `frontend/tailwind.config.ts`, add to `keyframes`:
   ```
   travel: {
     '0%': { transform: 'translateY(-100%)' },
     '100%': { transform: 'translateY(100%)' },
   }
   ```
2. Add to `animation`:
   ```
   travel: 'travel 1s linear infinite',
   ```

**Relevant Context**  
- `frontend/tailwind.config.ts` keyframes: line 66, animations: line 111

**Status**: [ ] pending

---

### Sub-Task 2 — Create `PipelineView.tsx`

**Intent**  
Build the new pipeline node component with full theme-accurate styling as described in the Visual
Design section above. This is the core deliverable.

**Expected Outcomes**  
- A centered glass-backed column renders all 5 agents as connected nodes.
- Each node circle, icon, name, status label, and connector line matches the spec above.
- Running connector shows the `animate-travel` band.
- All nodes enter with staggered `animate-rise`.

**Todo List**  
1. Create `frontend/src/components/PipelineView.tsx`.
2. Accept props `{ agents: AgentState[] }` (import `AgentState` from `../hooks/useAgentStream`).
3. Copy `AGENT_META` name lookup from `AgentCard.tsx` (only the `name` field is needed, drop
   `model` and `role`).
4. Outer wrapper: `mx-auto max-w-[480px]` glass card —
   `bg-white/5 backdrop-blur-sm border border-white/10 rounded-card px-8 py-8`.
5. For each agent, render a node row + connector (no connector after the last node):
   - Node row: `flex items-center gap-5`
   - Circle: 40×40px, style per status table above
   - Icon inside circle: per status table above
   - Right column: name (`font-display text-[17px] font-semibold text-mist`) +
     status label (`text-[12px]`, color per status)
   - Entry animation: `animate-rise` with `style={{ animationDelay: index * 0.1 + 's' }}`
6. Connector between nodes: `mx-auto w-0.5 h-[52px] relative overflow-hidden`, background per
   status of the node above. Add inner travelling band div when status is `running`.
7. The connector is centered under the circle — use `ml-[calc(20px-1px)]` (half of 40px circle
   minus half of 2px line) to align it.

**Relevant Context**  
- `frontend/src/hooks/useAgentStream.ts`: `AgentState` type
- `frontend/src/components/AgentCard.tsx`: `AGENT_META` and status color logic to adapt
- Theme: `mist`, `mist-muted`, `leaf`, `leaf-soft`, `forest`, `shadow-glow`, `animate-pulse-glow`
- `index.css` `.glass` class pattern: `bg-white/10 backdrop-blur-sm border border-white/20`

**Status**: [ ] pending

---

### Sub-Task 3 — Wire `PipelineView` into `AgentStatusPage` and remove `AgentCard`

**Intent**  
Replace the old card grid in `AgentStatusPage` with `<PipelineView>` and delete the now-unused
`AgentCard` component.

**Expected Outcomes**  
- `AgentStatusPage` renders `<PipelineView agents={agents} />` instead of the grid of cards.
- `AgentCard.tsx` is deleted.
- No broken imports remain.

**Todo List**  
1. In `AgentStatusPage.tsx`:
   - Remove `import AgentCard from '../components/AgentCard'`.
   - Add `import PipelineView from '../components/PipelineView'`.
   - Replace `<div className="grid gap-4">{agents.map((agent, i) => <AgentCard ... />)}</div>`
     with `<PipelineView agents={agents} />`.
2. Delete `frontend/src/components/AgentCard.tsx`.

**Relevant Context**  
- `frontend/src/pages/AgentStatusPage.tsx` line ~80: the grid block to replace
- `frontend/src/components/AgentCard.tsx`: to be deleted

**Status**: [ ] pending
