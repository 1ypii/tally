import styled from '@emotion/styled'
import { useEffect, useRef, useState } from 'react'
import { decimalsOf, money } from './api'

const Box = styled.div`
  position: relative;
  width: 100%;

  svg {
    display: block;
    overflow: visible;
  }
  .grid line {
    stroke: var(--line);
    stroke-width: 1;
  }
  .axis text {
    fill: var(--muted);
    font-size: 11.5px;
    font-variant-numeric: tabular-nums;
  }
  .hit {
    fill: transparent;
    cursor: crosshair;
  }
  .cross {
    stroke: var(--muted);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  path,
  rect.mark,
  circle {
    transition: opacity 0.15s ease;
  }
`

const Tip = styled.div`
  position: absolute;
  top: 8px;
  z-index: 5;
  min-width: 170px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.2);
  pointer-events: none;
  font-size: 13px;
  transition: left 0.08s ease-out;

  b {
    display: block;
    margin-bottom: 6px;
  }
  div {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: space-between;
  }
  span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: var(--muted);
  }
  i {
    width: 10px;
    height: 10px;
    border-radius: 3px;
  }
  em {
    font-style: normal;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
`

const LegendRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 14px;
  font-size: 13px;
  color: var(--muted);

  span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
  i {
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }
  i.line {
    height: 3px;
    border-radius: 2px;
  }
`

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.floor(entry.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return { ref, width }
}

function niceTicks(min: number, max: number, count = 5) {
  if (max === min) max = min + 1
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v))
  return ticks
}

function compact(minor: number, cur: string) {
  const value = minor / 10 ** decimalsOf(cur)
  const abs = Math.abs(value)
  const n = abs >= 1e6 ? `${+(value / 1e6).toFixed(1)}m` : abs >= 1e3 ? `${+(value / 1e3).toFixed(1)}k` : `${+value.toFixed(0)}`
  return n
}

function smooth(points: [number, number][]) {
  const n = points.length
  if (n < 2) return n ? `M${points[0][0]},${points[0][1]}` : ''

  const slopes: number[] = []
  for (let i = 0; i < n - 1; i++) {
    slopes.push((points[i + 1][1] - points[i][1]) / (points[i + 1][0] - points[i][0]))
  }

  const t = points.map((_, i) => {
    if (i === 0) return slopes[0]
    if (i === n - 1) return slopes[n - 2]
    return slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2
  })

  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = t[i] / slopes[i]
    const b = t[i + 1] / slopes[i]
    const s = a * a + b * b
    if (s > 9) {
      const k = 3 / Math.sqrt(s)
      t[i] = k * a * slopes[i]
      t[i + 1] = k * b * slopes[i]
    }
  }

  let d = `M${points[0][0]},${points[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    const h = (x1 - x0) / 3
    d += ` C${x0 + h},${y0 + t[i] * h} ${x1 - h},${y1 - t[i + 1] * h} ${x1},${y1}`
  }
  return d
}

type Series = { name: string; color: string; values: number[]; kind: 'bar' | 'line' }

const pad = { top: 12, right: 12, bottom: 28, left: 52 }

export function Legend({ items }: { items: { name: string; color: string; line?: boolean }[] }) {
  return (
    <LegendRow>
      {items.map((it) => (
        <span key={it.name}>
          <i className={it.line ? 'line' : ''} style={{ background: it.color }} />
          {it.name}
        </span>
      ))}
    </LegendRow>
  )
}

export function MonthChart({ labels, series, cur, height = 280 }: { labels: string[]; series: Series[]; cur: string; height?: number }) {
  const { ref, width } = useWidth()
  const [hover, setHover] = useState<number | null>(null)

  const all = series.flatMap((s) => s.values)
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all))
  const lo = ticks[0]
  const hi = ticks[ticks.length - 1]
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const band = plotW / labels.length
  const y = (v: number) => pad.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH
  const cx = (i: number) => pad.left + band * i + band / 2

  const bars = series.filter((s) => s.kind === 'bar')
  const lines = series.filter((s) => s.kind === 'line')
  const gap = 2
  const groupW = Math.min(band * 0.7, 56)
  const barW = bars.length ? (groupW - gap * (bars.length - 1)) / bars.length : 0

  return (
    <Box ref={ref} onMouseLeave={() => setHover(null)}>
      <svg width={width} height={height} role="img" aria-label={`${series.map((s) => s.name).join(', ')} by month`}>
        <g className="grid">
          {ticks.map((t) => (
            <line key={t} x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        <g className="axis">
          {ticks.map((t) => (
            <text key={t} x={pad.left - 10} y={y(t) + 4} textAnchor="end">
              {compact(t, cur)}
            </text>
          ))}
          {labels.map((l, i) =>
            band < 34 && i % 2 === 1 ? null : (
              <text key={l + i} x={cx(i)} y={height - 8} textAnchor="middle">
                {l}
              </text>
            ),
          )}
        </g>

        {hover !== null && <line className="cross" x1={cx(hover)} x2={cx(hover)} y1={pad.top} y2={pad.top + plotH} />}

        {bars.map((s, si) =>
          s.values.map((v, i) => {
            if (v === 0) return null
            const x = cx(i) - groupW / 2 + si * (barW + gap)
            const top = y(Math.max(v, 0))
            const h = Math.max(1, Math.abs(y(v) - y(0)))
            const r = Math.min(4, barW / 2, h)
            const d =
              v > 0
                ? `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`
                : `M${x},${y(0)} H${x + barW} V${y(0) + h - r} Q${x + barW},${y(0) + h} ${x + barW - r},${y(0) + h} H${x + r} Q${x},${y(0) + h} ${x},${y(0) + h - r} Z`
            return <path key={s.name + i} d={d} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.45} />
          }),
        )}

        {lines.map((s) => {
          const pts = s.values.map((v, i) => [cx(i), y(v)] as [number, number])
          return (
            <g key={s.name}>
              <path d={smooth(pts)} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" />
              {pts.map(([px, py], i) => (
                <circle
                  key={i}
                  cx={px}
                  cy={py}
                  r={hover === i ? 5 : 3.5}
                  fill={s.color}
                  stroke="var(--bg)"
                  strokeWidth={2}
                  opacity={hover === null || hover === i ? 1 : 0.5}
                />
              ))}
            </g>
          )
        })}

        {labels.map((l, i) => (
          <rect key={'h' + l + i} className="hit" x={pad.left + band * i} y={pad.top} width={band} height={plotH} onMouseEnter={() => setHover(i)} />
        ))}
      </svg>

      {hover !== null && (
        <Tip style={{ left: Math.min(Math.max(cx(hover) + 14, 0), width - 190) }}>
          <b>{labels[hover]}</b>
          {series.map((s) => (
            <div key={s.name}>
              <span>
                <i style={{ background: s.color }} />
                {s.name}
              </span>
              <em>{money(s.values[hover], cur)}</em>
            </div>
          ))}
        </Tip>
      )}
    </Box>
  )
}

export function AreaChart({ labels, values, cur, color, name, height = 220 }: { labels: string[]; values: number[]; cur: string; color: string; name: string; height?: number }) {
  const { ref, width } = useWidth()
  const [hover, setHover] = useState<number | null>(null)

  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values), 4)
  const lo = ticks[0]
  const hi = ticks[ticks.length - 1]
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const step = plotW / Math.max(1, labels.length - 1)
  const x = (i: number) => pad.left + step * i
  const y = (v: number) => pad.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number])
  const line = smooth(pts)
  const area = pts.length ? `${line} L${x(pts.length - 1)},${y(Math.max(lo, 0))} L${x(0)},${y(Math.max(lo, 0))} Z` : ''

  return (
    <Box ref={ref} onMouseLeave={() => setHover(null)}>
      <svg width={width} height={height} role="img" aria-label={`${name} by month`}>
        <g className="grid">
          {ticks.map((t) => (
            <line key={t} x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        <g className="axis">
          {ticks.map((t) => (
            <text key={t} x={pad.left - 10} y={y(t) + 4} textAnchor="end">
              {compact(t, cur)}
            </text>
          ))}
          {labels.map((l, i) =>
            step < 34 && i % 2 === 1 && i !== labels.length - 1 ? null : (
              <text key={l + i} x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}>
                {l}
              </text>
            ),
          )}
        </g>
        <path d={area} fill={color} opacity={0.12} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
        {hover !== null && (
          <>
            <line className="cross" x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + plotH} />
            <circle cx={x(hover)} cy={y(values[hover])} r={5} fill={color} stroke="var(--bg)" strokeWidth={2} />
          </>
        )}
        {labels.map((l, i) => (
          <rect key={'h' + l + i} className="hit" x={x(i) - step / 2} y={pad.top} width={step} height={plotH} onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {hover !== null && (
        <Tip style={{ left: Math.min(Math.max(x(hover) + 14, 0), width - 190) }}>
          <b>{labels[hover]}</b>
          <div>
            <span>
              <i style={{ background: color }} />
              {name}
            </span>
            <em>{money(values[hover], cur)}</em>
          </div>
        </Tip>
      )}
    </Box>
  )
}

const DonutWrap = styled.div`
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 24px;
  align-items: center;

  .center {
    font-size: 12px;
    fill: var(--muted);
  }
  .total {
    font-size: 17px;
    font-weight: 650;
    fill: var(--text);
    font-variant-numeric: tabular-nums;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 8px;
  }
  li {
    display: grid;
    grid-template-columns: 12px 1fr auto auto;
    gap: 10px;
    align-items: center;
    padding: 4px 6px;
    border-radius: 7px;
    transition: background 0.12s ease;
  }
  li.on {
    background: var(--hover);
  }
  li i {
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }
  li b {
    font-variant-numeric: tabular-nums;
  }
  li small {
    width: 38px;
    text-align: right;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
    justify-items: center;
    ul {
      width: 100%;
    }
  }
`

const slots = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)']

export function Donut({ items, cur, centerLabel }: { items: { label: string; value: number }[]; cur: string; centerLabel: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const sorted = [...items].sort((a, b) => b.value - a.value)
  const shown = sorted.length > 8 ? [...sorted.slice(0, 7), { label: 'everything else', value: sorted.slice(7).reduce((s, i) => s + i.value, 0) }] : sorted
  const total = shown.reduce((s, i) => s + i.value, 0)

  const size = 180
  const r = 74
  const stroke = 22
  const c = 2 * Math.PI * r
  let offset = 0

  return (
    <DonutWrap>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {shown.map((it, i) => {
            const len = total ? (it.value / total) * c : 0
            const seg = (
              <circle
                key={it.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={slots[i]}
                strokeWidth={hover === i ? stroke + 4 : stroke}
                strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
                strokeDashoffset={-offset}
                opacity={hover === null || hover === i ? 1 : 0.4}
                style={{ transition: 'stroke-width 0.15s ease, opacity 0.15s ease' }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            )
            offset += len
            return seg
          })}
        </g>
        <text className="center" x="50%" y="46%" textAnchor="middle">
          {hover !== null ? shown[hover].label : centerLabel}
        </text>
        <text className="total" x="50%" y="58%" textAnchor="middle">
          {money(hover !== null ? shown[hover].value : total, cur)}
        </text>
      </svg>
      <ul>
        {shown.map((it, i) => (
          <li key={it.label} className={hover === i ? 'on' : ''} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <i style={{ background: slots[i] }} />
            <span>{it.label}</span>
            <b>{money(it.value, cur)}</b>
            <small>{total ? Math.round((it.value / total) * 100) : 0}%</small>
          </li>
        ))}
      </ul>
    </DonutWrap>
  )
}
