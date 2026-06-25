import { useRef, useState } from 'react'
import { Sparkles, ChevronDown, Star, CheckCircle2, ShieldAlert, Download } from 'lucide-react'
import type { RoadmapOutput, RoadmapMilestone } from '../types'

// ── Cute pastel palette cycling across milestones ────────────────────────────
const NODE_PALETTES = [
  { bg: '#fde8f0', border: '#f4a7c3', text: '#8b2252', badge: '#f9c6db', divider: '#f9c6db' }, // rose
  { bg: '#fef3e2', border: '#f5c97a', text: '#7a4a00', badge: '#fde6a8', divider: '#fde6a8' }, // amber
  { bg: '#e8f5e9', border: '#81c784', text: '#1b5e20', badge: '#c8e6c9', divider: '#c8e6c9' }, // green
  { bg: '#e3f2fd', border: '#90caf9', text: '#0d47a1', badge: '#bbdefb', divider: '#bbdefb' }, // blue
  { bg: '#f3e5f5', border: '#ce93d8', text: '#4a148c', badge: '#e1bee7', divider: '#e1bee7' }, // purple
  { bg: '#fff8e1', border: '#ffcc80', text: '#6d4c00', badge: '#ffe0b2', divider: '#ffe0b2' }, // orange
  { bg: '#e8f5e9', border: '#a5d6a7', text: '#2e7d32', badge: '#c8e6c9', divider: '#c8e6c9' }, // mint
  { bg: '#fce4ec', border: '#f48fb1', text: '#880e4f', badge: '#f8bbd0', divider: '#f8bbd0' }, // pink
]

// ── SVG layout constants ──────────────────────────────────────────────────────
const NODE_W = 240   // node width
const NODE_H = 200   // node height — tall enough for all text rows
const H_GAP  = 60    // horizontal gap between nodes in the same row
const V_GAP  = 70    // vertical gap between rows (connectors travel here)
const COLS   = 2     // milestones per row
const PAD    = 44    // canvas padding
const NP     = 12    // inner horizontal padding inside a node

function calcSvgLayout(milestones: RoadmapMilestone[]) {
  const rows   = Math.ceil(milestones.length / COLS)
  const totalW = COLS * NODE_W + (COLS - 1) * H_GAP + PAD * 2
  const totalH = rows * NODE_H + (rows - 1) * V_GAP + PAD * 2 + 60
  return { totalW, totalH }
}

function nodePos(i: number) {
  const row      = Math.floor(i / COLS)
  const col      = i % COLS
  const snakeCol = row % 2 === 0 ? col : COLS - 1 - col
  const x        = PAD + snakeCol * (NODE_W + H_GAP)
  const y        = PAD + row * (NODE_H + V_GAP)
  // Expose all four edge midpoints — connectors attach here, never to the center
  return {
    x, y,
    cx:     x + NODE_W / 2,
    cy:     y + NODE_H / 2,
    left:   x,
    right:  x + NODE_W,
    top:    y,
    bottom: y + NODE_H,
  }
}

// Word-wrap helper: split a string into lines that each fit within maxPx at the
// given approximate character-width (Arial ~6px per char at 9px font).
function wrapText(text: string, maxPx: number, charPx = 6): string[] {
  const maxChars = Math.floor(maxPx / charPx)
  const words    = text.split(' ')
  const lines: string[] = []
  let   cur      = ''
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word
    if (candidate.length <= maxChars) {
      cur = candidate
    } else {
      if (cur) lines.push(cur)
      // If single word is still too long, let it overflow (better than hiding)
      cur = word
    }
  }
  if (cur) lines.push(cur)
  return lines
}

// ── Download helper ───────────────────────────────────────────────────────────
function downloadSvgAsPng(svgEl: SVGSVGElement, filename: string) {
  // Get the intrinsic viewBox dimensions for a crisp 2× export
  const vb        = svgEl.viewBox.baseVal
  const scale     = 2
  const W         = vb.width  * scale
  const H         = vb.height * scale

  // Serialize to data URI
  const serializer = new XMLSerializer()
  const svgStr     = serializer.serializeToString(svgEl)
  const svgBlob    = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url        = URL.createObjectURL(svgBlob)

  const img = new Image()
  img.onload = () => {
    const canvas  = document.createElement('canvas')
    canvas.width  = W
    canvas.height = H
    const ctx     = canvas.getContext('2d')!
    // White background so the #fff9fc canvas tints correctly
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
    ctx.drawImage(img, 0, 0, W, H)
    URL.revokeObjectURL(url)
    canvas.toBlob((blob) => {
      if (!blob) return
      const a    = document.createElement('a')
      a.href     = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    }, 'image/png')
  }
  img.src = url
}

// ── Flowchart SVG ─────────────────────────────────────────────────────────────
function FlowchartSVG({
  milestones,
  svgRef,
}: {
  milestones: RoadmapMilestone[]
  svgRef: React.RefObject<SVGSVGElement>
}) {
  const { totalW, totalH } = calcSvgLayout(milestones)

  // ── Fixed vertical layout offsets inside every node ──────────────────────
  const BADGE_H    = 22   // floating month-badge height
  const NUM_R      = 11   // step-number circle radius
  const TEXT_W     = NODE_W - NP * 2

  // Y offsets from node.y
  const STEP_CY    = 26   // centre of step-number circle
  const TITLE_Y    = 16   // first title tspan baseline
  const TITLE_LINEH = 13  // px between title lines
  const DIV_Y      = 50   // divider line
  const DESC_Y     = 62   // description first line baseline
  const DESC_LINEH = 12   // px between desc lines
  const DELIV_Y    = 110  // first deliverable baseline
  const DELIV_LINEH= 12
  const FOOTER_Y   = NODE_H - 8  // footer baseline

  // Text widths for word-wrap
  const TITLE_W    = TEXT_W - NUM_R * 2 - 8   // title lives beside the step circle
  const BODY_W     = TEXT_W                    // description & deliverables use full width

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${totalW} ${totalH}`}
      width="100%"
      style={{ maxWidth: totalW, display: 'block', margin: '0 auto' }}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Program roadmap flowchart"
    >
      <defs>
        <filter id="rm-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#00000022" />
        </filter>
        <marker id="rm-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 z" fill="#c8a0c0" />
        </marker>
      </defs>

      {/* Canvas background */}
      <rect width={totalW} height={totalH} rx="24" fill="#fff9fc" />

      {/* Decorative background symbols */}
      {([
        [totalW * 0.06, totalH * 0.05, '✿'],
        [totalW * 0.92, totalH * 0.08, '✦'],
        [totalW * 0.03, totalH * 0.55, '♡'],
        [totalW * 0.94, totalH * 0.62, '✿'],
        [totalW * 0.50, totalH * 0.96, '✦'],
      ] as [number, number, string][]).map(([px, py, sym], di) => (
        <text key={di} x={px} y={py} fontSize="15" textAnchor="middle"
          dominantBaseline="middle" opacity="0.20" fill="#d1a8c7">
          {sym}
        </text>
      ))}

      {/* ── Connectors — drawn BEFORE nodes so nodes paint on top ── */}
      {milestones.map((_, i) => {
        if (i === milestones.length - 1) return null

        const cur    = nodePos(i)
        const nxt    = nodePos(i + 1)
        const curRow = Math.floor(i / COLS)
        const nxtRow = Math.floor((i + 1) / COLS)

        if (curRow === nxtRow) {
          // ── Horizontal connector: right-edge → left-edge (same row) ──────
          // For even rows: cur.right → nxt.left
          // For odd  rows: cur.left  → nxt.right  (snake reverses direction)
          const x1 = curRow % 2 === 0 ? cur.right : cur.left
          const x2 = curRow % 2 === 0 ? nxt.left  : nxt.right
          const my = cur.cy  // both nodes are on the same row, same cy
          return (
            <line key={i}
              x1={x1} y1={my} x2={x2} y2={my}
              stroke="#c8a0c0" strokeWidth="2" strokeDasharray="6 4"
              markerEnd="url(#rm-arrow)" />
          )
        } else {
          // ── Row-break elbow: exits through the BOTTOM of cur-node,
          //    travels DOWN through the gap, then enters the TOP of nxt-node.
          //    The horizontal leg stays entirely inside the gap zone. ────────
          //
          //  Even row ends on the right  →  elbow goes right-then-down-then-left
          //  Odd  row ends on the left   →  elbow goes left-then-down-then-right
          const exitX  = curRow % 2 === 0 ? cur.right  : cur.left
          const enterX = nxtRow % 2 === 0 ? nxt.left   : nxt.right
          // Horizontal leg at the vertical midpoint between the two rows
          const midY   = cur.bottom + V_GAP / 2
          // Elbow x: stay in the gap (not over any node)
          const elbX   = curRow % 2 === 0
            ? cur.right + H_GAP / 2      // right of the rightmost node
            : cur.left  - H_GAP / 2      // left  of the leftmost node

          // Path: exit right-edge of cur → go right to elbow → drop down to midY
          //       → go left to nxt x → enter top-edge of nxt
          return (
            <path key={i}
              d={`M ${exitX} ${cur.cy} H ${elbX} V ${midY} H ${enterX} V ${nxt.top}`}
              fill="none" stroke="#c8a0c0" strokeWidth="2" strokeDasharray="6 4"
              markerEnd="url(#rm-arrow)" />
          )
        }
      })}

      {/* ── Nodes — painted AFTER connectors so they cover the lines ── */}
      {milestones.map((m, i) => {
        const pal          = NODE_PALETTES[i % NODE_PALETTES.length]
        const { x, y, cx } = nodePos(i)
        const badgeW       = Math.min(NODE_W - 24, m.month.length * 8 + 28)
        const delivCount   = m.deliverables.length
        const respCount    = m.responsible.length

        // Word-wrapped lines
        const titleLines = wrapText(m.title,       TITLE_W, 6.5)
        const descLines  = wrapText(m.description, BODY_W,  5.8)
        const d0Lines    = m.deliverables[0]
          ? wrapText(m.deliverables[0], BODY_W - 10, 5.8)
          : []

        return (
          <g key={i} filter="url(#rm-shadow)">
            {/* ── Node body — paint over any connector lines ── */}
            <rect x={x} y={y} width={NODE_W} height={NODE_H}
              rx="18" ry="18" fill={pal.bg} stroke={pal.border} strokeWidth="2" />

            {/* ── Month badge — straddles top edge ── */}
            <rect x={cx - badgeW / 2} y={y - BADGE_H / 2}
              width={badgeW} height={BADGE_H} rx="11" ry="11"
              fill={pal.badge} stroke={pal.border} strokeWidth="1.5" />
            <text x={cx} y={y + 2}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fontWeight="700" fill={pal.text}
              fontFamily="Arial, sans-serif">
              {m.month}
            </text>

            {/* ── Step-number circle ── */}
            <circle cx={x + NP + NUM_R} cy={y + STEP_CY} r={NUM_R} fill={pal.border} />
            <text x={x + NP + NUM_R} y={y + STEP_CY}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fontWeight="800" fill={pal.text}
              fontFamily="Arial, sans-serif">
              {i + 1}
            </text>

            {/* ── Title (word-wrapped tspan lines, beside step circle) ── */}
            <text
              x={x + NP + NUM_R * 2 + 8} y={y + TITLE_Y}
              fontSize="10.5" fontWeight="700" fill={pal.text}
              fontFamily="Arial, sans-serif">
              {titleLines.slice(0, 3).map((line, li) => (
                <tspan key={li} x={x + NP + NUM_R * 2 + 8} dy={li === 0 ? 0 : TITLE_LINEH}>
                  {line}
                </tspan>
              ))}
            </text>

            {/* ── Divider ── */}
            <line x1={x + NP} y1={y + DIV_Y} x2={x + NODE_W - NP} y2={y + DIV_Y}
              stroke={pal.divider} strokeWidth="1" />

            {/* ── Description (word-wrapped, max 3 lines) ── */}
            <text x={x + NP} y={y + DESC_Y}
              fontSize="8.5" fill={pal.text} opacity="0.82"
              fontFamily="Arial, sans-serif">
              {descLines.slice(0, 3).map((line, li) => (
                <tspan key={li} x={x + NP} dy={li === 0 ? 0 : DESC_LINEH}>
                  {line}
                </tspan>
              ))}
            </text>

            {/* ── First deliverable with bullet (word-wrapped, max 2 lines) ── */}
            {d0Lines.length > 0 && (
              <>
                <circle cx={x + NP + 3} cy={y + DELIV_Y - 3} r="2.5" fill={pal.border} />
                <text x={x + NP + 10} y={y + DELIV_Y}
                  fontSize="8.5" fill={pal.text} opacity="0.88"
                  fontFamily="Arial, sans-serif">
                  {d0Lines.slice(0, 2).map((line, li) => (
                    <tspan key={li} x={x + NP + 10} dy={li === 0 ? 0 : DELIV_LINEH}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </>
            )}

            {/* ── Footer: deliverable + role counts ── */}
            <text x={x + NP} y={y + FOOTER_Y}
              fontSize="7.5" fill={pal.text} opacity="0.50"
              fontFamily="Arial, sans-serif">
              {[
                delivCount > 0 ? `${delivCount} deliverable${delivCount > 1 ? 's' : ''}` : '',
                respCount  > 0 ? `${respCount} role${respCount > 1 ? 's' : ''}` : '',
              ].filter(Boolean).join('  ·  ')}
            </text>
          </g>
        )
      })}

      {/* ✦ Start label above first node */}
      {milestones.length > 0 && (() => {
        const { cx, top } = nodePos(0)
        return (
          <text x={cx} y={top - 24} textAnchor="middle" dominantBaseline="middle"
            fontSize="10" fontWeight="600" fill="#b07ab0" fontFamily="Arial, sans-serif">
            ✦ Start
          </text>
        )
      })()}

      {/* ♡ Complete label below last node */}
      {milestones.length > 0 && (() => {
        const { cx, bottom } = nodePos(milestones.length - 1)
        return (
          <text x={cx} y={bottom + 22} textAnchor="middle" dominantBaseline="middle"
            fontSize="10" fontWeight="600" fill="#b07ab0" fontFamily="Arial, sans-serif">
            ♡ Complete
          </text>
        )
      })()}
    </svg>
  )
}

// ── Preview card (shown before expanding full roadmap) ────────────────────────
function RoadmapPreview({
  roadmap,
  onConfirm,
}: {
  roadmap: RoadmapOutput
  onConfirm: () => void
}) {
  return (
    <div className="animate-rise rounded-card border-2 border-dashed border-leaf/40 bg-panel p-7">
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <Sparkles size={14} className="text-leaf" />
        <span className="text-[11px] font-semibold uppercase tracking-label text-forest">
          Roadmap Preview
        </span>
      </div>
      <p className="mb-5 text-[14px] text-secondary">{roadmap.summary}</p>

      {/* Compact milestone list */}
      <div className="mb-5 grid gap-2 sm:grid-cols-2">
        {roadmap.milestones.map((m, i) => {
          const pal = NODE_PALETTES[i % NODE_PALETTES.length]
          return (
            <div
              key={i}
              className="flex items-start gap-2.5 rounded-xl p-3"
              style={{ background: pal.bg, border: `1.5px solid ${pal.border}` }}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{ background: pal.badge, color: pal.text }}
              >
                {i + 1}
              </span>
              <div>
                <p className="text-[12px] font-semibold" style={{ color: pal.text }}>
                  {m.title}
                </p>
                <p className="text-[11px]" style={{ color: pal.text, opacity: 0.75 }}>
                  {m.month}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary stats row */}
      <div className="mb-6 flex flex-wrap gap-2 text-[12px]">
        <span className="rounded-full border border-hairline bg-canvas/60 px-3 py-1 text-secondary">
          <Star size={10} className="mr-1 inline text-leaf" />
          {roadmap.milestones.length} milestones
        </span>
        <span className="rounded-full border border-hairline bg-canvas/60 px-3 py-1 text-secondary">
          <CheckCircle2 size={10} className="mr-1 inline text-leaf" />
          {roadmap.success_criteria.length} success criteria
        </span>
        <span className="rounded-full border border-hairline bg-canvas/60 px-3 py-1 text-secondary">
          <ShieldAlert size={10} className="mr-1 inline text-forest" />
          {roadmap.key_risks.length} key risks
        </span>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onConfirm}
        className="pill inline-flex w-full items-center justify-center gap-2 bg-leaf py-2.5 text-[13px] font-semibold text-white shadow-glow transition-all duration-300 hover:scale-[1.02] hover:bg-leaf-bright"
      >
        <Sparkles size={14} strokeWidth={1.8} />
        View Full Flowchart Roadmap
        <ChevronDown size={14} strokeWidth={2} />
      </button>
    </div>
  )
}

// ── Full roadmap (flowchart + detail panels) ──────────────────────────────────
function RoadmapFull({ roadmap }: { roadmap: RoadmapOutput }) {
  const svgRef = useRef<SVGSVGElement>(null)

  function handleDownload() {
    if (!svgRef.current) return
    const slug = roadmap.milestones[0]?.title
      ? roadmap.milestones[0].title.toLowerCase().replace(/\s+/g, '-').slice(0, 32)
      : 'roadmap'
    downloadSvgAsPng(svgRef.current, `roadmap-${slug}.png`)
  }

  return (
    <div className="space-y-5 animate-rise">
      {/* Flowchart */}
      <div className="card-surface overflow-hidden rounded-card p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles size={12} className="text-leaf" />
            <span className="text-[11px] font-semibold uppercase tracking-label text-forest">
              Flowchart Roadmap
            </span>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="pill inline-flex items-center gap-1.5 border border-hairline bg-white px-3.5 py-1.5 text-[12px] font-medium text-forest transition-all duration-200 hover:scale-105 hover:border-leaf hover:shadow-glow"
          >
            <Download size={13} strokeWidth={1.8} />
            Download Image
          </button>
        </div>
        <div className="rounded-2xl border border-hairline bg-[#fff9fc] p-4">
          <FlowchartSVG milestones={roadmap.milestones} svgRef={svgRef} />
        </div>
      </div>

      {/* Milestone detail cards */}
      <div className="card-surface rounded-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-label text-forest">
            Milestone Details
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {roadmap.milestones.map((m, i) => {
            const pal = NODE_PALETTES[i % NODE_PALETTES.length]
            return (
              <div
                key={i}
                className="rounded-xl p-4"
                style={{ background: pal.bg, border: `1.5px solid ${pal.border}` }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ background: pal.badge, color: pal.text }}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: pal.badge, color: pal.text }}
                  >
                    {m.month}
                  </span>
                </div>
                <p className="mb-1 text-[13px] font-semibold" style={{ color: pal.text }}>
                  {m.title}
                </p>
                <p className="mb-2 text-[12px]" style={{ color: pal.text, opacity: 0.8 }}>
                  {m.description}
                </p>
                {m.deliverables.length > 0 && (
                  <ul className="space-y-0.5">
                    {m.deliverables.map((d, j) => (
                      <li key={j} className="flex gap-1.5 text-[11px]" style={{ color: pal.text, opacity: 0.9 }}>
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full" style={{ background: pal.border }} />
                        {d}
                      </li>
                    ))}
                  </ul>
                )}
                {m.responsible.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.responsible.map((r, j) => (
                      <span
                        key={j}
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{ background: pal.badge, color: pal.text }}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Success criteria + Key risks */}
      <div className="grid gap-5 sm:grid-cols-2">
        {roadmap.success_criteria.length > 0 && (
          <div className="card-surface rounded-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#e8f5e9] text-[#2e7d32]">
                <CheckCircle2 size={14} strokeWidth={1.7} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-label text-forest">
                Success Criteria
              </span>
            </div>
            <ul className="space-y-1.5">
              {roadmap.success_criteria.map((c, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-primary">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
        {roadmap.key_risks.length > 0 && (
          <div className="card-surface rounded-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#fde8f0] text-[#8b2252]">
                <ShieldAlert size={14} strokeWidth={1.7} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-label text-forest">
                Key Risks
              </span>
            </div>
            <ul className="space-y-1.5">
              {roadmap.key_risks.map((r, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-primary">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f4a7c3]" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
/** Renders the AI-generated roadmap. Shows a compact preview first; clicking
 *  "View Full Flowchart Roadmap" expands to the cute SVG flowchart + details. */
export default function RoadmapView({ roadmap }: { roadmap: RoadmapOutput }) {
  const [confirmed, setConfirmed] = useState(false)

  if (!confirmed) {
    return <RoadmapPreview roadmap={roadmap} onConfirm={() => setConfirmed(true)} />
  }

  return <RoadmapFull roadmap={roadmap} />
}
