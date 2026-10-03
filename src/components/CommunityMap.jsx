import { memo, useMemo } from 'react'
import { DT_RATING, DT_HOMES, SPECIAL, solarShape, homePv } from '../sim/engine.js'
import { statusOf, STATUS_META, homeEnergy } from '../sim/model.js'

/**
 * Living community map — a stylised, fictional neighbourhood on a HYPOTHETICAL Gujarat 11 kV feeder.
 * 34 of the 500 simulated homes are drawn; every home exists in the simulation.
 * Power path drawn: home → LT (low-voltage) street network → DT → 11 kV feeder → substation.
 * The VPP only sends data (dashed lines); it never carries power.
 */
export const W = 1400, H = 730
export const VB_Y = 20, VB_H = 688 // visible window (crops empty sky top and field bottom)
const SKY = 92
const TRUNK_Y = 326
const SUB = { x: 170, y: 420 }
const DISCOM = { x: 338, y: 430 }
export const VPP = { x: 1292, y: 425 }

// colonies: street y, DT position, house slots (x, row), spur x
const COLONIES = [
  { dt: 9, street: 560, x0: 555, x1: 1180, dtx: 820, spur: 808, label: 'DT-10 service area',
    top: [[595, 17], [670, 'm'], [742, 58], [900, 137], [975, 'm'], [1055, 141], [1135, 'm']],
    bot: [[595, 'm'], [675, 41], [755, 'm'], [895, 204], [975, 312], [1055, 229], [1135, 'm']] },
  { dt: 2, street: 205, x0: 70, x1: 455, dtx: 455, spur: 468, label: 'DT-3 area',
    top: [[110, 'c'], [200, 'm'], [290, 'c'], [380, 'm']], bot: [[110, 'm'], [200, 'c'], [290, 'm'], [380, 'c']] },
  { dt: 8, street: 205, x0: 900, x1: 1250, dtx: 900, spur: 888, label: 'DT-9 area',
    top: [[990, 'c'], [1080, 'm'], [1170, 'm']], bot: [[990, 'm'], [1080, 'c'], [1170, 'm']] },
  { dt: 10, street: 610, x0: 70, x1: 455, dtx: 455, spur: 468, label: 'DT-11 area',
    top: [[120, 'c'], [230, 'm'], [340, 'm']], bot: [[120, 'm'], [230, 'c'], [340, 'm']] },
]
const TOP_DY = -30, BOT_DY = 74

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Gujarat outline for the locator inset (stylised)
const GUJ = [
  'M90,232 C118,170 262,150 382,164 C474,176 522,202 516,232 C508,264 432,270 362,264 C282,259 182,276 122,264 C104,258 92,246 90,232 Z',
  'M150,430 C158,346 252,302 364,300 C474,298 566,330 596,384 C620,444 586,524 512,574 C452,614 360,632 288,606 C208,580 150,512 150,430 Z',
  'M556,190 C650,164 802,158 924,174 C1044,190 1112,242 1116,322 C1120,424 1070,524 1000,602 C950,656 878,692 818,690 C768,688 752,650 734,602 C694,512 636,444 598,384 C566,324 538,242 556,190 Z',
]

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const mix = (a, b, f) => {
  const A = hex(a), B = hex(b), g = Math.min(1, Math.max(0, f))
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * g).toString(16).padStart(2, '0')).join('')
}
const SKY_KEYS = [[5, '#dbe4dd'], [6.5, '#fbecd2'], [8.5, '#eaf4ec'], [16, '#eef5ee'], [17.8, '#f8e3c4'], [18.9, '#e6b98e'], [19.6, '#6f8a78'], [20.6, '#2c4638'], [24, '#223a2d']]
function skyAt(t) {
  for (let k = 0; k < SKY_KEYS.length - 1; k++) {
    const [t1, c1] = SKY_KEYS[k], [t2, c2] = SKY_KEYS[k + 1]
    if (t >= t1 && t <= t2) return mix(c1, c2, (t - t1) / (t2 - t1))
  }
  return t < SKY_KEYS[0][0] ? SKY_KEYS[0][1] : SKY_KEYS.at(-1)[1]
}
const darkAt = t => (t < 6.5 ? Math.max(0, 0.6 * (6.5 - t) / 1.5) : t < 18 ? 0 : Math.min(1, (t - 18) / 2.4))

function Particles({ path, n, dur, color, reverse, r = 3.4 }) {
  return Array.from({ length: n }, (_, k) => (
    <circle key={k} r={r} fill={color} stroke="#fff" strokeWidth="0.8" className={`particle ${reverse ? 'particle-rev' : ''}`}
      style={{ offsetPath: `path('${path}')`, '--dur': `${dur}s`, '--delay': `${-(k * dur) / n}s` }} />
  ))
}

export const DT_TONE = {
  green: { c: '#1f6b45', bg: '#e6f2ea' },
  amber: { c: '#b37511', bg: '#fbf1dc' },
  red: { c: '#c0452f', bg: '#fbe9e5' },
}


const SunIco = ({ x, y }) => <g><circle cx={x} cy={y} r={3.3} fill="#d7a12d" />{[0, 45, 90, 135].map(a => <line key={a} x1={x - 5.5 * Math.cos(a * Math.PI / 180)} y1={y - 5.5 * Math.sin(a * Math.PI / 180)} x2={x + 5.5 * Math.cos(a * Math.PI / 180)} y2={y + 5.5 * Math.sin(a * Math.PI / 180)} stroke="#d7a12d" strokeWidth="1" />)}</g>
const HomeIco = ({ x, y }) => <path d={`M${x - 4.5},${y + 4} v-4.5 l4.5,-4 l4.5,4 v4.5 z`} fill="#b3541e" />
function KwLabel({ x, y, pv, load }) {
  return (
    <g>
      <rect x={x - 36} y={y + 3} width={72} height={15} rx={2} fill="#ffffff" opacity="0.94" />
      <SunIco x={x - 28} y={y + 10.5} />
      <text x={x - 21} y={y + 14.5} fontSize="11.5" fontFamily="IBM Plex Mono, monospace" fontWeight="700" fill="#8a5d0f">{pv.toFixed(1)}</text>
      <HomeIco x={x + 7} y={y + 10.5} />
      <text x={x + 13} y={y + 14.5} fontSize="11.5" fontFamily="IBM Plex Mono, monospace" fontWeight="700" fill="#9b3f1a">{load.toFixed(1)}</text>
    </g>
  )
}

function House({ h, x, y, st, e, hr, dark, faded, picked, ring, verdict, below, idBold, requested, onEnter, onLeave, onClick }) {
  const col = STATUS_META[st].color
  const pv = h.kwp > 0 ? homePv(h, hr) : 0
  const soc = e.soc
  const dot = e.state === 'surplus' ? '#d7a12d' : e.state === 'deficit' ? '#c0452f' : '#4fa36a'
  return (
    <g transform={`translate(${x},${y})`} opacity={faded ? 0.28 : 1} style={{ cursor: 'pointer', transition: 'opacity .3s' }}
      onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick}>
      <rect x={-38} y={-60} width={76} height={78} rx={5} fill="#e7efe3" stroke="#d2ddcf" />
      {ring && <rect x={-41} y={-63} width={82} height={84} rx={7} fill="none" stroke={ring} strokeWidth="2.6" className={ring === '#4fa36a' ? 'ring-soft' : ''} />}
      {picked && <rect x={-42} y={-64} width={84} height={86} rx={8} fill="none" stroke="#163a28" strokeWidth="1.8" strokeDasharray="4 3" />}
      <KwLabel x={0} y={0} pv={e.pv} load={e.load} />
      <ellipse cx={-4} cy={2} rx={28} ry={3} fill="#d3ddcf" />
      <rect x={-27} y={-35} width={46} height={5} rx={1} fill="#d8d0bd" />
      <rect x={-24} y={-30} width={40} height={30} fill="#fbfaf4" stroke="#9fb0a4" strokeWidth="1" />
      <rect x={-19} y={-23} width={8} height={8} fill={dark > 0.1 ? '#f2c865' : '#dbe6e0'} opacity={dark > 0.1 ? 0.6 + 0.4 * dark : 1} />
      <rect x={-8} y={-23} width={8} height={8} fill={dark > 0.1 ? '#f2c865' : '#dbe6e0'} opacity={dark > 0.1 ? 0.6 + 0.4 * dark : 1} />
      <rect x={4} y={-16} width={8} height={16} fill="#c7b491" />
      {h.kwp > 0 && (
        <g>
          <polygon points="-24,-35 14,-35 9,-50 -19,-50" fill="#2e5046" />
          <path d="M-14.5,-35 L-10.7,-50 M-5,-35 L-1.7,-50 M4.5,-35 L7.3,-50 M-21.5,-42.5 L11.5,-42.5" stroke="#6f8f86" strokeWidth="0.6" />
          <polygon points="-24,-35 14,-35 9,-50 -19,-50" fill="#f3c24f" opacity={st === 'curtailed' ? 0.2 : Math.min(0.8, pv / 2.6)} />
        </g>
      )}
      {/* battery + gateway */}
      <rect x={20} y={-27} width={13} height={27} rx={2.5} fill="#ffffff" stroke={col} strokeWidth="1.8" />
      <rect x={22.5} y={-24.5 + 22 * (1 - soc)} width={8} height={Math.max(1, 22 * soc)} rx={1.2} fill={col} />
      <line x1={18} x2={35} y1={-24.5 + 22 * (1 - h.battery.reserve)} y2={-24.5 + 22 * (1 - h.battery.reserve)} stroke="#163a28" strokeWidth="1.4" />
      {st === 'charging' && <path d="M26.5,-6 l-3,4 h6 z" transform="rotate(180 26.5 -4)" fill="#ffffff" />}
      {st === 'discharging' && <path d="M26.5,-6 l-3,4 h6 z" fill="#ffffff" />}
      {h.battery.controllable && (
        <g>
          <line x1={26.5} y1={-27} x2={26.5} y2={-36} stroke={st === 'offline' ? '#a9b0ac' : '#1f6b45'} strokeWidth="1.3" />
          <circle cx={26.5} cy={-38} r={2.6} fill={st === 'offline' ? '#a9b0ac' : '#1f6b45'} />
          {st === 'offline' && <path d="M22,-45 l9,9 m0,-9 l-9,9" stroke="#8e2f1f" strokeWidth="1.6" />}
        </g>
      )}
      <circle cx={31} cy={-53} r={4} fill={dot} stroke="#fff" strokeWidth="1" />
      {requested && <g><rect x={-6} y={-60} width={30} height={13} rx={3} fill="#1f6b45" /><text x={9} y={-50.5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#fff">VPP</text></g>}
      <text x={-33} y={-47} fontSize="11" fontWeight={idBold ? 700 : 500} fill={idBold ? '#163a28' : '#7d8b82'} fontFamily="IBM Plex Mono, monospace">{h.id}</text>
      {verdict && (
        <g transform={`translate(0,${below ? 32 : -72})`}><g className="fadein">
          <rect x={-(verdict.text.length * 3.6 + 12)} y={-11} width={verdict.text.length * 7.2 + 24} height={22} rx={11}
            fill={verdict.ok ? '#1f6b45' : '#ffffff'} stroke={verdict.ok ? '#1f6b45' : verdict.col} strokeWidth="1.4" />
          <text x={0} y={4.5} textAnchor="middle" fontSize="12" fontWeight="700" fill={verdict.ok ? '#ffffff' : verdict.col}>{verdict.text}</text>
        </g></g>
      )}
    </g>
  )
}

function CommunityMap({ sim, hour, stepIdx, trunkTone, requestedIds, showVpp, vppLabel, scanning, verdicts, supportIds, dataLinks, dtDisplay, callouts, filter, pickedId, onHover, onPick }) {
  const step = sim.withVpp.steps[stepIdx]

  const layout = useMemo(() => {
    const byId = id => sim.homes[id - 1]
    return COLONIES.map(c => {
      const inDt = sim.homes.filter(h => h.dt === c.dt)
      const special = new Set([SPECIAL.SETTLED, SPECIAL.RESERVE, SPECIAL.COMMS, SPECIAL.FULL, SPECIAL.STANDBY, ...SPECIAL.HELPERS])
      const ctrl = inDt.filter(h => h.battery.controllable && !special.has(h.id))
      const mon = inDt.filter(h => !h.battery.controllable)
      const monSolar = mon.filter(h => h.kwp > 0), monPlain = mon.filter(h => h.kwp === 0)
      const monPick = []; for (let k = 0; monPick.length < 8; k++) { if (monSolar[k]) monPick.push(monSolar[k]); if (monPlain[k] && monPick.length < 8) monPick.push(monPlain[k]); if (k > 50) break }
      let ci = 0, mi = 0
      const take = v => (typeof v === 'number' ? byId(v) : v === 'c' ? ctrl[ci++] : monPick[mi++])
      const slots = [
        ...c.top.map(([x, v]) => ({ h: take(v), x, y: c.street + TOP_DY, below: false })),
        ...c.bot.map(([x, v]) => ({ h: take(v), x, y: c.street + BOT_DY, below: true })),
      ].filter(s => s.h)
      // power path from each street end to the DT, then up/down the spur to the 11 kV trunk and on to the substation
      const toSub = `L${c.spur},${c.street} L${c.spur},${TRUNK_Y} L${SUB.x},${TRUNK_Y} L${SUB.x},${SUB.y - 30}`
      const ends = [c.x0, c.x1].filter(x => Math.abs(x - c.dtx) > 30)
      const paths = ends.map(x => `M${x},${c.street} L${c.dtx},${c.street} ${toSub}`)
      return { ...c, slots, paths }
    })
  }, [sim])

  const trees = useMemo(() => {
    const rnd = mulberry32(77)
    const zones = [[560, 372, 230, 88, 14], [80, 360, 60, 70, 4], [1200, 250, 180, 60, 5], [1200, 470, 180, 60, 3], [80, 712, 380, 14, 5], [560, 700, 620, 20, 6], [1270, 110, 100, 60, 3], [560, 120, 300, 50, 3]]
    const out = []
    zones.forEach(([x, y, w, hgt, n]) => { for (let k = 0; k < n; k++) out.push([x + rnd() * w, y + rnd() * hgt, 7 + rnd() * 6]) })
    return out
  }, [])

  const sky = skyAt(hour)
  const dark = darkAt(hour)
  const sunP = (hour - 6.2) / 12.8, moonP = (hour - 19.0) / 9
  const arc = p => ({ x: 120 + p * 1160, y: 70 - Math.sin(Math.PI * p) * 46 })
  const sun = arc(Math.min(1, Math.max(0, sunP))), moon = arc(Math.min(1, Math.max(0, moonP)))
  const feederNet = step.feederNet
  const TRUNK = { green: '#3d7d59', sun: '#b58a26', amber: '#c98a1b', orange: '#c56a1e', red: '#c0452f', vpp: '#2f8f6b' }[trunkTone] || '#3d7d59'

  const matchFilter = (h, st, e) => {
    if (!filter || filter === 'all') return true
    if (filter === 'surplus' || filter === 'deficit') return e.state === filter
    if (filter === 'reserve') return st === 'reserve'
    if (filter === 'offline') return st === 'offline'
    return st === filter
  }

  return (
    <svg viewBox={`0 ${VB_Y} ${W} ${VB_H}`} className="block h-auto w-full select-none" role="img"
      aria-label="Stylised neighbourhood map of a hypothetical Gujarat 11 kV feeder" onClick={() => onPick(null)}>
      <defs>
        <linearGradient id="skyg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={mix(sky, '#000000', dark * 0.25)} />
          <stop offset="1" stopColor={mix(sky, '#ffffff', 0.25 - dark * 0.2)} />
        </linearGradient>
        <pattern id="field" width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill="#edf3e8" /><path d="M0,14 L14,0" stroke="#e1eadb" strokeWidth="1" />
        </pattern>
      </defs>

      {/* ground */}
      <rect width={W} height={H} fill="#f1f5ee" />
      <rect x="530" y="360" width="270" height="110" rx="10" fill="url(#field)" />
      <text x="665" y="458" textAnchor="middle" fontSize="11" fill="#8fa296" fontStyle="italic">community park</text>
      
      <rect x="60" y="708" width="410" height="30" rx="10" fill="url(#field)" />
      

      {/* roads */}
      {[
        `M0,340 L${W},340`, `M480,${SKY} L480,${H}`, `M820,340 L820,560`, `M900,${SKY + 70} L900,340`,
        ...COLONIES.map(c => `M${c.x0 - 10},${c.street} L${c.x1 + 10},${c.street}`),
      ].map((d, k) => (
        <g key={k}>
          <path d={d} stroke="#dcd5c4" strokeWidth={k < 2 ? 26 : 18} strokeLinecap="round" fill="none" />
          <path d={d} stroke="#f6f2e7" strokeWidth={k < 2 ? 22 : 14} strokeLinecap="round" fill="none" />
          {k === 0 && <path d={d} stroke="#e4dccb" strokeWidth="1.2" strokeDasharray="12 12" fill="none" />}
        </g>
      ))}
      <text x="1010" y="360" fontSize="11" fill="#9aa79d" letterSpacing="2">MAIN ROAD</text>

      {/* trees */}
      {trees.map(([x, y, r], k) => (
        <g key={'t' + k}><circle cx={x} cy={y + 2} r={r} fill="#c5d8bf" /><circle cx={x} cy={y} r={r} fill={k % 3 ? '#a4c79d' : '#8dbb87'} /></g>
      ))}

      {/* DT-10 service area outline */}
      <rect x="548" y="468" width="640" height="192" rx="14" fill={scanning ? '#e2f0e6' : 'none'} stroke={scanning || supportIds?.size ? '#4fa36a' : '#b9cbbd'}
        strokeWidth={scanning ? 2.4 : 1.2} strokeDasharray="6 5" className={scanning ? 'pulse' : ''} />
      <text x="560" y="678" fontSize="12" fontWeight="700" fill="#2f4a3b">DT-10 service area <tspan fontWeight="400" fill="#6b7a70">· {DT_HOMES[9]} homes on this transformer · 14 shown</tspan></text>
      {layout.filter(c => c.dt !== 9).map(c => (
        <text key={'al' + c.dt} x={c.dtx > c.x0 + 100 ? c.x0 + 4 : c.x1 - 4} textAnchor={c.dtx > c.x0 + 100 ? 'start' : 'end'} y={c.street - 88} fontSize="11" fill="#6b7a70">
          <tspan fontWeight="700" fill="#2f4a3b">{c.label}</tspan> · {DT_HOMES[c.dt]} homes
        </text>
      ))}

      {/* LT street network + service drops */}
      {layout.map(c => (
        <g key={'lt' + c.dt}>
          <line x1={c.x0} y1={c.street} x2={c.x1} y2={c.street} stroke="#7f978a" strokeWidth="1.6" />
          {c.slots.map(({ h, x, below }) => {
            const on = supportIds?.has(h.id)
            return <line key={h.id} x1={x + 26} y1={c.street} x2={x + 26} y2={c.street + (below ? 16 : -12)} stroke={on ? '#2f8f6b' : '#7f978a'} strokeWidth={on ? 3 : 1.2} />
          })}
          {c.dt === 9 && supportIds?.size > 0 && c.slots.filter(s => supportIds.has(s.h.id)).map(({ h, x }) => (
            <line key={'hl' + h.id} x1={x + 26} y1={c.street} x2={c.dtx} y2={c.street} stroke="#2f8f6b" strokeWidth="3.4" opacity="0.55" />
          ))}
        </g>
      ))}
      <text x="1000" y="575" fontSize="10.5" fill="#6b7a70" fontStyle="italic">LT network (415 V)</text>

      {/* houses */}
      {layout.map(c => c.slots.map(({ h, x, y, below }) => {
        const st = statusOf(h, step, hour)
        const e = homeEnergy(sim, h, stepIdx)
        const v = verdicts?.[h.id]
        return (
          <House key={h.id} h={h} x={x} y={y} st={st} e={e} hr={hour} dark={dark} below={below}
            faded={!matchFilter(h, st, e)} picked={pickedId === h.id}
            ring={supportIds?.has(h.id) ? '#4fa36a' : scanning && h.dt === 9 && h.battery.controllable ? '#9fcbad' : null}
            verdict={v} requested={requestedIds?.has(h.id) && step.dis[h.id - 1] > 0.05} idBold={[SPECIAL.SETTLED, SPECIAL.RESERVE, SPECIAL.COMMS, SPECIAL.FULL, SPECIAL.STANDBY, ...SPECIAL.HELPERS].includes(h.id)}
            onEnter={() => onHover({ id: h.id, x, y: y - 60 })} onLeave={() => onHover(null)}
            onClick={ev => { ev.stopPropagation(); onPick({ id: h.id, x, y: y - 60 }) }} />
        )
      }))}

      {/* 11 kV feeder: trunk + spurs with poles */}
      {(() => {
        const segs = [
          `M${SUB.x},${SUB.y - 30} L${SUB.x},${TRUNK_Y} L1300,${TRUNK_Y}`,
          ...[...new Set(COLONIES.map(c => `${c.spur}|${c.street}`))].map(k => { const [x, y] = k.split('|').map(Number); return `M${x},${TRUNK_Y} L${x},${y}` }),
        ]
        const poles = []
        for (let x = 210; x <= 1290; x += 60) poles.push([x, TRUNK_Y])
        return (
          <g>
            {segs.map((d, k) => <path key={k} d={d} stroke={TRUNK} strokeWidth="3" fill="none" strokeLinejoin="round" style={{ transition: 'stroke .8s' }} />)}
            {poles.map(([x, y], k) => (
              <g key={k}><line x1={x - 6} y1={y - 5} x2={x + 6} y2={y - 5} stroke="#51695c" strokeWidth="1.6" /><circle cx={x} cy={y} r={2.6} fill="#51695c" /></g>
            ))}
            <rect x="1150" y={TRUNK_Y - 24} width="120" height="18" rx="9" fill="#ffffff" stroke={TRUNK} />
            <text x="1210" y={TRUNK_Y - 11} textAnchor="middle" fontSize="11" fontWeight="700" fill={TRUNK}>11 kV feeder</text>
          </g>
        )
      })()}

      {/* night overlay */}
      <rect y={SKY} width={W} height={H - SKY} fill="#0d2b1d" opacity={0.27 * dark} pointerEvents="none" />
      {/* lit windows on top of the night */}
      {dark > 0.15 && layout.map(c => c.slots.map(({ h, x, y }) => (
        <g key={'w' + h.id} pointerEvents="none" opacity={dark}>
          <KwLabel x={x} y={y} pv={homePv(h, hour)} load={homeEnergy(sim, h, stepIdx).load} />
          <rect x={x - 19} y={y - 23} width={8} height={8} fill="#f6cd6b" /><rect x={x - 8} y={y - 23} width={8} height={8} fill="#f6cd6b" />
        </g>
      )))}

      {/* energy flow along the real network path */}
      {layout.map(c => {
        const net = step.dtNet[c.dt]
        if (Math.abs(net) < 3) return null
        const n = Math.min(4, Math.max(1, Math.round(Math.abs(net) / 18)))
        return c.paths.map((p, k) => (
          <Particles key={`p${c.dt}-${k}`} path={p} n={n} dur={7} reverse={net > 0}
            color={net < 0 ? '#d9962a' : '#8aa594'} />
        ))
      })}
      {/* battery discharge: home → service drop → street → DT */}
      {layout.map(c => c.slots.map(({ h, x, below }) => {
        if (step.dis[h.id - 1] < 0.3 || !step.vpp?.[h.id - 1]) return null // only VPP-requested discharge flows to the DT
        const p = `M${x + 26},${c.street + (below ? 16 : -12)} L${x + 26},${c.street} L${c.dtx},${c.street}`
        return <Particles key={'d' + h.id} path={p} n={2} dur={2} color="#2f8f6b" r={3.6} />
      }))}

      {/* distribution transformers (pole-mounted) */}
      {layout.map(c => {
        const d = dtDisplay?.[c.dt] || (() => {
          const pct = 100 * step.dtNet[c.dt] / DT_RATING[c.dt]
          return { pct, tone: pct > 100 ? 'red' : pct > 90.5 || pct < -40 ? 'amber' : 'green' }
        })()
        const T = DT_TONE[d.tone]
        const label = d.pct < 0 ? `DT-${c.dt + 1} · ${Math.abs(d.pct).toFixed(0)}% export` : `DT-${c.dt + 1} · ${d.pct.toFixed(0)}%`
        const cw = label.length * 7.4 + 22
        const x = c.dtx, y = c.street
        return (
          <g key={'dt' + c.dt} onMouseEnter={() => onHover({ dt: c.dt, x, y: y - 60 })} onMouseLeave={() => onHover(null)} style={{ cursor: 'help' }}>
            <line x1={x - 9} y1={y - 38} x2={x - 9} y2={y + 4} stroke="#51695c" strokeWidth="2.4" />
            <line x1={x + 9} y1={y - 38} x2={x + 9} y2={y + 4} stroke="#51695c" strokeWidth="2.4" />
            <rect x={x - 15} y={y - 30} width={30} height={20} rx={3} fill="#ffffff" stroke={T.c} strokeWidth="2.4" style={{ transition: 'stroke .6s' }} />
            <path d={`M${x - 5},${y - 26} l4,6 h-3 l3,6`} stroke={T.c} strokeWidth="1.6" fill="none" />
            <line x1={x - 8} y1={y - 34} x2={x - 8} y2={y - 30} stroke={T.c} strokeWidth="1.6" /><line x1={x + 8} y1={y - 34} x2={x + 8} y2={y - 30} stroke={T.c} strokeWidth="1.6" />
            <g>
              <rect x={x - cw / 2} y={y - 64} width={cw} height={24} rx={12} fill={T.bg} stroke={T.c} strokeWidth="1.6" style={{ transition: 'fill .6s, stroke .6s' }} />
              <text x={x} y={y - 47.5} textAnchor="middle" fontSize="13" fontWeight="700" fill={T.c} fontFamily="IBM Plex Mono, monospace">{label}</text>
            </g>
            {d.ghost && (
              <g className="fadein">
                <line x1={x} y1={y - 116} x2={x} y2={y - 64} stroke="#c0452f" strokeDasharray="2 3" />
                <rect x={x - 82} y={y - 140} width={164} height={24} rx={12} fill="#ffffff" stroke="#c0452f" strokeDasharray="4 3" />
                <text x={x} y={y - 123.5} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#c0452f" fontFamily="IBM Plex Mono, monospace">{d.ghost}</text>
              </g>
            )}
            {d.forecast && (
              <g className="fadein">
                <line x1={x} y1={y - 116} x2={x} y2={y - 64} stroke="#c0452f" strokeWidth="1.5" />
                <rect x={x - 104} y={y - 142} width={208} height={26} rx={13} fill="#c0452f" className="pulse-strong" />
                <text x={x} y={y - 124.5} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#ffffff">{d.forecast}</text>
              </g>
            )}
          </g>
        )
      })}

      {/* substation + DISCOM */}
      <g>
        <rect x={SUB.x - 62} y={SUB.y - 30} width={124} height={78} rx={6} fill="#f7f9f6" stroke="#8fa296" strokeDasharray="4 3" />
        {[0, 1].map(k => (
          <g key={k} transform={`translate(${SUB.x - 44 + k * 50},${SUB.y - 16})`}>
            <rect width="38" height="30" rx="3" fill="#eef3ee" stroke="#51695c" strokeWidth="1.4" />
            <circle cx="12" cy="15" r="6" fill="none" stroke="#51695c" /><circle cx="24" cy="15" r="6" fill="none" stroke="#51695c" />
          </g>
        ))}
        <text x={SUB.x} y={SUB.y + 34} textAnchor="middle" fontSize="12" fontWeight="700" fill="#163a28">Substation 66/11 kV</text>
        <rect x={SUB.x - 70} y={SUB.y + 54} width={140} height={22} rx={11}
          fill={feederNet < -5 ? '#fbf1dc' : '#e6f2ea'} stroke={feederNet < -5 ? '#c98a1b' : '#1f6b45'} />
        <text x={SUB.x} y={SUB.y + 69} textAnchor="middle" fontSize="12" fontWeight="700" fontFamily="IBM Plex Mono, monospace"
          fill={feederNet < -5 ? '#8a5d0f' : '#1f6b45'}>
          {feederNet < -5 ? `${Math.abs(feederNet).toFixed(0)} kW back` : `${feederNet.toFixed(0)} kW supply`}
        </text>
        <g transform={`translate(${DISCOM.x},${DISCOM.y})`}>
          <rect x="-34" y="-30" width="68" height="44" rx="3" fill="#ffffff" stroke="#8fa296" />
          <rect x="-34" y="-30" width="68" height="9" fill="#1f6b45" />
          {[0, 1, 2, 3].map(k => <rect key={k} x={-26 + k * 14} y="-15" width="9" height="9" fill="#dfe8df" />)}
          <text x="0" y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="#163a28">DISCOM</text>
        </g>
        <line x1={SUB.x + 62} y1={SUB.y} x2={DISCOM.x - 34} y2={DISCOM.y - 8} stroke="#8fa296" strokeDasharray="3 4" />
      </g>

      {/* VPP control node + data links (data, not power) */}
      {showVpp && (
        <g className="fadein">
          {dataLinks?.map(id => { let q = null; layout.forEach(c => c.slots.forEach(s => { if (s.h.id === id) q = s })); return q }).filter(Boolean).map(({ h: { id }, x, y }) => (
            <path key={'dl' + id} d={`M${VPP.x - 60},${VPP.y + 24} Q${(VPP.x + x) / 2},${Math.min(VPP.y, y) + 40} ${x + 26},${y - 38}`}
              stroke="#2f8f6b" strokeWidth="1.5" fill="none" strokeDasharray="5 6" className="dash-move" />
          ))}
          <rect x={VPP.x - 88} y={VPP.y - 26} width={176} height={52} rx={8} fill="#ffffff" stroke="#1f6b45" strokeWidth="1.8" />
          <g transform={`translate(${VPP.x - 74},${VPP.y - 14})`}>
            <rect width="22" height="28" rx="3" fill="#1f6b45" />
            {[5, 12, 19].map(yy => <g key={yy}><rect x="4" y={yy} width="14" height="3" rx="1" fill="#cfe6d6" /><circle cx="16" cy={yy + 1.5} r="1" fill="#f3c24f" /></g>)}
          </g>
          <text x={VPP.x - 44} y={VPP.y - 3} fontSize="13" fontWeight="800" fill="#163a28" fontFamily="Archivo, sans-serif">FeederFleet VPP</text>
          <text x={VPP.x - 44} y={VPP.y + 13} fontSize="11" fill="#2f8f6b" fontWeight="600">{vppLabel}</text>
        </g>
      )}

      {/* callouts */}
      {callouts?.map(({ id, text }) => {
        let pos = null
        layout.forEach(c => c.slots.forEach(s => { if (s.h.id === id) pos = s }))
        if (!pos) return null
        const w = text.length * 7 + 28
        const bx = pos.x, by = pos.below ? pos.y + 32 : pos.y - 74
        return (
          <g key={'co' + id} className="fadein" pointerEvents="none">
            <rect x={bx - w / 2} y={by - 12} width={w} height={24} rx={12} fill="#fbf1dc" stroke="#c98a1b" strokeWidth="1.4" />
            <text x={bx} y={by + 4.5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#8a5d0f">{text}</text>
          </g>
        )
      })}

      {/* sky band (drawn last so it sits above the land edge) */}
      <rect width={W} height={SKY} fill="url(#skyg)" />
      <path d={`M0,${SKY} ${Array.from({ length: 36 }, (_, k) => `L${k * 40},${SKY - 8 - ((k * 37) % 5) * 3} L${k * 40 + 26},${SKY - 8 - ((k * 37) % 5) * 3} L${k * 40 + 26},${SKY}`).join(' ')} L${W},${SKY} Z`}
        fill={mix('#cfdccf', '#1b3326', dark)} />
      {dark > 0.3 && [[180, 22], [330, 40], [520, 18], [700, 36], [880, 16], [1040, 44], [1200, 24], [1330, 50]].map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r="1.4" fill="#fff" opacity={dark * 0.8} />
      ))}
      {sunP > -0.03 && sunP < 1.03 && (
        <g><circle cx={sun.x} cy={sun.y} r={26} fill="#f6d68c" opacity={0.35} /><circle cx={sun.x} cy={sun.y} r={14} fill="#f0b43c" /></g>
      )}
      {hour >= 19.0 && (
        <g><circle cx={moon.x} cy={moon.y} r={12} fill="#f3efe2" /><circle cx={moon.x - 5} cy={moon.y - 3} r={10} fill={mix(sky, '#000000', dark * 0.25)} /></g>
      )}
      <line x1="0" y1={SKY} x2={W} y2={SKY} stroke="#c9d6ca" />

      {/* locator inset */}
      <g transform="translate(1212,600)">
        <rect width="178" height="112" rx="8" fill="#ffffff" stroke="#d2ddcf" />
        <g transform="translate(10,8) scale(0.14)">{GUJ.map((d, k) => <path key={k} d={d} fill="#e3eee0" stroke="#9fb7a2" strokeWidth="8" />)}</g>
        <circle cx={10 + 700 * 0.14} cy={8 + 430 * 0.14} r="5" fill="#c0452f" stroke="#fff" strokeWidth="1.5" />
        <text x="10" y="94" fontSize="10.5" fontWeight="700" fill="#2f4a3b">Gujarat — illustrative location</text>
        <text x="10" y="106" fontSize="9.5" fill="#6b7a70">Hypothetical feeder · not to scale</text>
      </g>
    </svg>
  )
}

export default memo(CommunityMap)
export const COLONY_DEFS = COLONIES
export { SPECIAL }
export const solarNow = solarShape
