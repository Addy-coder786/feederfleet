// Two live diagrams for the Overview tab: the system work diagram and the "how to reduce the load curve" loop.
// Every number shown is read from the simulation (seed 20260927) — nothing is hard-coded.
import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea } from 'recharts'
import { HERO_DT, MATCH_HR } from '../sim/engine.js'
import { homeEnergy, stepOf, fmtHr, statusOf, STATUS_META } from '../sim/model.js'
import { SimBadge } from './ui.jsx'

const C_WITHOUT = '#b3541e'
const C_WITH = '#2f8f6b'
const DIAGRAM_HOMES = [137, 58, 17] // all under DT-10
const kw = v => `${v >= 0 ? '' : '−'}${Math.abs(v).toFixed(1)} kW`

/* ───────────────────────── 1 · WORK DIAGRAM ───────────────────────── */

export function WorkDiagram({ sim }) {
  const ev = sim.hero
  const TIMES = [
    { k: 'midday', label: 'Midday 13:00', hr: 13.0 },
    { k: 'event', label: `Evening peak ${fmtHr(ev.forecastPeakStep / 4)}`, hr: ev.forecastPeakStep / 4 },
  ]
  const [tk, setTk] = useState('event')
  const T = TIMES.find(t => t.k === tk)
  const st = stepOf(T.hr)
  const s = sim.withVpp.steps[st], s0 = sim.without.steps[st]
  const rating = sim.dtRating[HERO_DT]
  const dtKw = s.dtNet[HERO_DT], dtKw0 = s0.dtNet[HERO_DT]
  const reverse = dtKw < 0
  const ampsLt = Math.abs(dtKw) * 1000 / (Math.sqrt(3) * 415) // LT side, pf ≈ 1 assumed
  const feederKw = s.feederNet, feederKw0 = s0.feederNet
  const evening = tk === 'event'

  // cycle the highlighted cloud function so the engine visibly "works"
  const FUNCS = ['Detect DT stress', 'Match & dispatch', 'Forecast', 'Optimise', 'Community map', 'Real-time generation / consumption per household']
  const [fi, setFi] = useState(0)
  useEffect(() => { const id = setInterval(() => setFi(x => (x + 1) % FUNCS.length), 1600); return () => clearInterval(id) }, [])

  const homes = DIAGRAM_HOMES.map(id => {
    const h = sim.homes[id - 1]
    const e = homeEnergy(sim, h, st)
    const status = statusOf(h, s, T.hr)
    return { h, e, status }
  })
  const fills = ['#eef3fb', '#fdf6e6', '#eef7ef']
  const strokes = ['#9db3d6', '#e2c98d', '#9fcbad']

  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-bold">FeederFleet · work diagram</h3>
        <SimBadge />
        <div className="ml-auto flex gap-1 rounded-md border border-line p-0.5">
          {TIMES.map(t => (
            <button key={t.k} onClick={() => setTk(t.k)} className={`rounded px-3 py-1 text-xs font-semibold ${tk === t.k ? 'bg-grid text-white' : 'text-fgb hover:bg-panel2'}`}>{t.label}</button>
          ))}
        </div>
      </div>
      <p className="mb-2 text-xs text-dim">Live readings from the simulated DT-10 (100 kVA) and three of its homes. Dashed green = data over 4G. Solid = electric power (it never flows through the VPP cloud).</p>
      <div className="overflow-x-auto">
        <svg viewBox="0 0 1220 500" className="min-w-[900px] w-full" role="img" aria-label="FeederFleet work diagram">
          <defs>
            <marker id="wd-g" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#1f6b45" /></marker>
            <marker id="wd-p" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill={evening ? C_WITHOUT : '#c98a1b'} /></marker>
          </defs>

          {/* PROSUMERS */}
          <rect x="70" y="6" width="170" height="30" rx="6" fill="#fbeef0" stroke="#e3b3bb" />
          <text x="155" y="26" textAnchor="middle" fontSize="14" fontWeight="800" fill="#163a28" letterSpacing="1">PROSUMERS</text>
          {homes.map(({ h, e, status }, k) => {
            const y = 50 + k * 148
            const meta = STATUS_META[status]
            const batt = e.dis > 0.05 ? `discharging ${e.dis.toFixed(1)} kW` : e.chg > 0.05 ? `charging ${e.chg.toFixed(1)} kW` : 'idle'
            return (
              <g key={h.id}>
                <rect x="10" y={y} width="290" height="132" rx="8" fill={fills[k]} stroke={strokes[k]} strokeWidth="1.4" />
                <text x="26" y={y + 24} fontSize="15" fontWeight="800" fill="#163a28">Home {k + 1} · #{h.id}</text>
                <g transform={`translate(262 ${y + 8})`}>
                  <path d="M2,14 L13,4 L24,14 Z" fill="#d9603b" /><rect x="5" y="14" width="16" height="12" fill="#f5e6c8" stroke="#8a5d0f" strokeWidth="0.8" /><rect x="11" y="18" width="5" height="8" fill="#8a5d0f" />
                </g>
                <text x="26" y={y + 46} fontSize="12" fill="#2f4a3b">Inverter → Modbus → Battery · API / Cloud</text>
                <text x="26" y={y + 68} fontSize="12" fill="#6b7a70">solar <tspan fill="#8a5d0f" fontWeight="700">{e.pv.toFixed(1)} kW</tspan> · load <tspan fill="#163a28" fontWeight="700">{e.load.toFixed(1)} kW</tspan></text>
                {/* SoC bar with reserve line */}
                <text x="26" y={y + 92} fontSize="12" fill="#6b7a70">SoC</text>
                <rect x="56" y={y + 82} width="150" height="12" rx="3" fill="#ffffff" stroke="#c3cec6" />
                <rect x="56" y={y + 82} width={150 * e.soc} height="12" rx="3" fill={meta.color} />
                <line x1={56 + 150 * h.battery.reserve} x2={56 + 150 * h.battery.reserve} y1={y + 78} y2={y + 98} stroke="#163a28" strokeWidth="1.6" strokeDasharray="2 2" />
                <text x="214" y={y + 92} fontSize="12" fontWeight="700" fill="#163a28">{Math.round(e.soc * 100)}%</text>
                <text x="250" y={y + 92} fontSize="10" fill="#6b7a70">res {Math.round(h.battery.reserve * 100)}%</text>
                <text x="26" y={y + 116} fontSize="12" fill={meta.color} fontWeight="700">● {meta.label}</text>
                <text x="180" y={y + 116} fontSize="11" fill="#6b7a70">{batt}</text>
              </g>
            )
          })}
          {/* bracket + 4G link to cloud */}
          <path d="M306,116 H322 V412 H306 M322,264 H372" fill="none" stroke="#1f6b45" strokeWidth="1.6" strokeDasharray="6 5" className="dash-move" markerEnd="url(#wd-g)" />
          <text x="340" y="214" textAnchor="middle" fontSize="11" fill="#1f6b45">via</text>
          <text x="340" y="228" textAnchor="middle" fontSize="11" fill="#1f6b45">4G</text>
          {[0, 1, 2, 3].map(b => <rect key={b} x={330 + b * 6} y={248 - b * 4} width="4" height={6 + b * 4} fill="#1f6b45" />)}

          {/* VPP CLOUD ENGINE */}
          <rect x="378" y="50" width="270" height="430" rx="10" fill="#f1f0fb" stroke="#b9b5e0" strokeWidth="1.4" />
          <text x="398" y="84" fontSize="19" fontWeight="800" fill="#163a28">VPP Cloud Engine</text>
          <g transform="translate(596 64)">
            <path d="M4,22 a10,10 0 0 1 10,-12 a14,14 0 0 1 26,4 a8,8 0 0 1 0,16 H8 a8,8 0 0 1 -4,-8 z" fill="#c7d8f2" stroke="#4a6fa5" strokeWidth="1.2" />
          </g>
          {FUNCS.map((f, k) => {
            const on = k === fi
            const lines = f.length > 30 ? ['Real-time generation /', 'consumption per household'] : [f]
            const y = 112 + k * 40
            return (
              <g key={f}>
                <rect x="392" y={y - 16} width="242" height={lines.length * 17 + 12} rx="5" fill={on ? '#1f6b45' : '#ffffff'} stroke={on ? '#1f6b45' : '#dcd9f0'} style={{ transition: 'fill .3s, stroke .3s' }} />
                {lines.map((l, j) => <text key={j} x="404" y={y + 1 + j * 17} fontSize="13" fontWeight={on ? 700 : 500} fill={on ? '#ffffff' : '#2f4a3b'} style={{ transition: 'fill .3s' }}>{j === 0 ? '• ' : '  '}{l}</text>)}
              </g>
            )
          })}
          <rect x="392" y="372" width="242" height="94" rx="6" fill="#ffffff" stroke="#9fcbad" />
          <text x="404" y="392" fontSize="11" fontWeight="700" fill="#1f6b45">DECISION AT {fmtHr(T.hr)}</text>
          {evening ? (
            <>
              <text x="404" y="411" fontSize="12" fill="#2f4a3b">DT-10 forecast {Math.round(100 * ev.forecastPeakKw / rating)}% → target 90%</text>
              <text x="404" y="429" fontSize="12" fill="#2f4a3b">Request {ev.requiredKw.toFixed(0)} kW · matched {ev.match.matchedKw.toFixed(1)} kW</text>
              <text x="404" y="447" fontSize="12" fill="#2f4a3b">{ev.perHome.length} homes dispatched (merit order)</text>
            </>
          ) : (
            <>
              <text x="404" y="411" fontSize="12" fill="#2f4a3b">No DT overload forecast now</text>
              <text x="404" y="429" fontSize="12" fill="#2f4a3b">Batteries charge from own solar</text>
              <text x="404" y="447" fontSize="12" fill="#2f4a3b">Energy kept for tonight’s peak</text>
            </>
          )}

          {/* cloud ⇄ feeder data */}
          <path d="M652,240 H716" fill="none" stroke="#1f6b45" strokeWidth="1.6" strokeDasharray="6 5" className="dash-move" markerEnd="url(#wd-g)" />
          <text x="684" y="230" textAnchor="middle" fontSize="10" fill="#1f6b45">setpoints</text>
          <path d="M716,290 H652" fill="none" stroke="#1f6b45" strokeWidth="1.6" strokeDasharray="6 5" className="dash-move" markerEnd="url(#wd-g)" />
          <text x="684" y="306" textAnchor="middle" fontSize="10" fill="#1f6b45">readings</text>

          {/* FEEDER */}
          <rect x="722" y="50" width="250" height="430" rx="10" fill="#f0f8ee" stroke="#9fcbad" strokeWidth="1.4" />
          <text x="742" y="84" fontSize="19" fontWeight="800" fill="#163a28">Feeder · DT-10</text>
          <g transform="translate(930 60)" stroke="#163a28" strokeWidth="1.4" fill="none">
            <path d="M10,0 L2,36 M10,0 L18,36 M4,12 H16 M3,22 H17 M0,6 H20" />
          </g>
          <text x="742" y="108" fontSize="12" fill="#2f4a3b">Connected to the VPP via</text>
          <rect x="742" y="118" width="210" height="52" rx="6" fill="#ffffff" stroke="#1f6b45" strokeDasharray="4 3" />
          <text x="756" y="139" fontSize="12" fontWeight="700" fill="#163a28">DT smart sensor &amp; CT sensor</text>
          <text x="756" y="158" fontSize="11" fill="#6b7a70">sends readings over 4G every 15 min</text>
          {[
            ['Loading', `${kw(dtKw)} · ${Math.round(100 * dtKw / rating)}%`, Math.abs(dtKw) > 0.9 * rating ? '#b03a26' : '#163a28'],
            ['Without VPP', `${kw(dtKw0)} · ${Math.round(100 * dtKw0 / rating)}%`, '#6b7a70'],
            ['Current (LT)', `≈ ${Math.round(ampsLt)} A`, '#163a28'],
            ['Power flow', reverse ? 'REVERSE (to feeder)' : 'Forward (to homes)', reverse ? '#9a5f0a' : '#163a28'],
            ['Voltage', 'measured in pilot', '#6b7a70'],
          ].map(([a, b, c], k) => (
            <g key={a}>
              <text x="742" y={202 + k * 30} fontSize="12" fill="#6b7a70">{a}</text>
              <text x="952" y={202 + k * 30} textAnchor="end" fontSize="13" fontWeight="700" fill={c}>{b}</text>
              <line x1="742" x2="952" y1={210 + k * 30} y2={210 + k * 30} stroke="#dde6dd" />
            </g>
          ))}
          {/* DT loading gauge */}
          <text x="742" y="362" fontSize="11" fill="#6b7a70">DT-10 loading vs rating (100 kVA)</text>
          <rect x="742" y="376" width="210" height="16" rx="4" fill="#ffffff" stroke="#c3cec6" />
          <rect x="742" y="376" width={Math.min(210, 210 * Math.abs(dtKw0) / rating / 1.1)} height="16" rx="4" fill={C_WITHOUT} opacity="0.25" />
          <rect x="742" y="376" width={Math.min(210, 210 * Math.abs(dtKw) / rating / 1.1)} height="16" rx="4" fill={reverse ? '#c98a1b' : C_WITH} />
          <line x1={742 + 210 * 0.9 / 1.1} x2={742 + 210 * 0.9 / 1.1} y1="372" y2="396" stroke="#163a28" strokeDasharray="2 2" />
          <line x1={742 + 210 / 1.1} x2={742 + 210 / 1.1} y1="372" y2="396" stroke="#b03a26" />
          <text x={742 + 210 * 0.9 / 1.1} y="408" textAnchor="middle" fontSize="9" fill="#163a28">90%</text>
          <text x={742 + 210 / 1.1 + 2} y="369" textAnchor="start" fontSize="9" fill="#b03a26">100%</text>
          <text x="742" y="436" fontSize="11" fill="#6b7a70">faded bar = without VPP</text>
          <text x="742" y="456" fontSize="11" fill="#6b7a70">voltage is not modelled in this demo</text>

          {/* power: feeder ⇄ transmission grid / DISCOM ⇄ generator */}
          {evening ? (
            <path d="M1030,150 H978" fill="none" stroke={C_WITHOUT} strokeWidth="2.4" markerEnd="url(#wd-p)" />
          ) : (
            <path d="M978,150 H1030" fill="none" stroke="#c98a1b" strokeWidth="2.4" markerEnd="url(#wd-p)" />
          )}
          <rect x="1036" y="50" width="176" height="210" rx="10" fill="#fbeef0" stroke="#e3b3bb" strokeWidth="1.4" />
          <text x="1124" y="80" textAnchor="middle" fontSize="15" fontWeight="800" fill="#163a28">Transmission grid</text>
          <text x="1124" y="100" textAnchor="middle" fontSize="13" fontWeight="700" fill="#163a28">DISCOM substation</text>
          <text x="1124" y="130" textAnchor="middle" fontSize="11" fill="#6b7a70">11 kV feeder head</text>
          <text x="1124" y="156" textAnchor="middle" fontSize="16" fontWeight="800" fill={feederKw < 0 ? '#9a5f0a' : '#163a28'}>{kw(feederKw)}</text>
          <text x="1124" y="176" textAnchor="middle" fontSize="11" fill="#6b7a70">without VPP {kw(feederKw0)}</text>
          <text x="1124" y="206" textAnchor="middle" fontSize="11" fontWeight="700" fill={C_WITH}>{evening ? `${Math.round(feederKw0 - feederKw)} kW less drawn` : `${Math.round(feederKw - feederKw0)} kW less pushed back`}</text>
          <text x="1124" y="224" textAnchor="middle" fontSize="11" fill="#6b7a70">{evening ? 'at this moment' : 'reverse flow at this moment'}</text>
          <text x="1124" y="244" textAnchor="middle" fontSize="10" fill="#6b7a70">− = reverse flow</text>

          <path d={evening ? 'M1124,330 V266' : 'M1124,266 V330'} fill="none" stroke={evening ? C_WITHOUT : '#c98a1b'} strokeWidth="2.4" markerEnd="url(#wd-p)" />
          <text x="1134" y="304" fontSize="10" fill="#6b7a70">{evening ? 'supply' : 'surplus'}</text>
          <rect x="1036" y="336" width="176" height="144" rx="10" fill="#fdf6e6" stroke="#e2c98d" strokeWidth="1.4" />
          <text x="1124" y="366" textAnchor="middle" fontSize="16" fontWeight="800" fill="#163a28">Generator</text>
          <g transform="translate(1100 392)">
            <rect x="0" y="14" width="48" height="24" fill="#e7ede8" stroke="#163a28" /><rect x="6" y="0" width="7" height="16" fill="#b03a26" /><rect x="20" y="4" width="7" height="12" fill="#b03a26" />
            <circle cx="12" cy="-6" r="4" fill="#c3cec6" /><circle cx="18" cy="-12" r="5" fill="#d7ddd9" />
          </g>
          <text x="1124" y="450" textAnchor="middle" fontSize="11" fill="#2f4a3b">{evening ? 'Lower evening peak' : 'Midday: less reverse'}</text>
          <text x="1124" y="466" textAnchor="middle" fontSize="11" fill="#2f4a3b">{evening ? 'to supply upstream' : 'flow sent upstream'}</text>
        </svg>
      </div>
      <p className="mt-2 text-[11px] text-dim">Current is estimated from kW at 415 V, power factor ≈ 1 (assumption). Homes exchange data with the cloud through a gateway (Modbus to the inverter) or the inverter maker’s cloud API. The arrows to the grid show which way power flows at the selected time.</p>
    </div>
  )
}

/* ───────────────────── 2 · HOW TO REDUCE THE LOAD CURVE ───────────────────── */

export function LoadCurveLoop({ sim }) {
  const ev = sim.hero
  const rating = sim.dtRating[HERO_DT]
  const enrolled = sim.homes.filter(h => h.dt === HERO_DT && h.battery.controllable)
  const peakHr = ev.forecastPeakStep / 4
  const NODES = [
    { k: 'Morning demand increases', hr: 7.5, icon: '↑', c: '#fbeef0', b: '#e3b3bb' },
    { k: 'Solar increases · midday', hr: 11.5, icon: '☀', c: '#fdf6e6', b: '#e2c98d' },
    { k: 'Solar surplus · batteries get charged', hr: 13.5, icon: '🔋', c: '#eef7ef', b: '#9fcbad' },
    { k: 'Evening · solar decreases', hr: 17.75, icon: '↓', c: '#eef3fb', b: '#9db3d6' },
    { k: 'Demand increases', hr: 18.5, icon: '↑', c: '#fbeef0', b: '#e3b3bb' },
    { k: 'DT stress detected', hr: MATCH_HR, icon: '⚠', c: '#f1f0fb', b: '#b9b5e0' },
    { k: 'Discharge batteries · keep backup reserve', hr: ev.activeStart / 4, icon: '⚡', c: '#eef7ef', b: '#9fcbad' },
    { k: 'Peak reduced', hr: peakHr, icon: '↘', c: '#fbeef0', b: '#e3b3bb' },
    { k: 'Night · battery reserve preserved', hr: 23.5, icon: '☾', c: '#eef3fb', b: '#9db3d6' },
  ]
  const [ni, setNi] = useState(7)
  const [play, setPlay] = useState(false)
  useEffect(() => {
    if (!play) return
    const id = setInterval(() => setNi(x => { if (x >= NODES.length - 1) { setPlay(false); return x } return x + 1 }), 1500)
    return () => clearInterval(id)
  }, [play])
  const node = NODES[ni]
  const st = stepOf(node.hr)

  const data = useMemo(() => sim.without.steps.map((s, t) => ({
    h: s.hr,
    without: +(100 * s.dtNet[HERO_DT] / rating).toFixed(1),
    withVpp: +(100 * sim.withVpp.steps[t].dtNet[HERO_DT] / rating).toFixed(1),
  })), [sim, rating])
  const peak0 = Math.max(...data.map(d => d.without)), peak1 = Math.max(...data.filter(d => d.h > 17).map(d => d.withVpp))
  const d = data[st]
  const socs = enrolled.map(h => sim.withVpp.steps[st].soc[h.id - 1])
  const avgSoc = socs.reduce((a, v) => a + v, 0) / socs.length
  const minAbove = Math.min(...enrolled.map(h => sim.withVpp.steps[st].soc[h.id - 1] - h.battery.reserve))
  const chg = enrolled.reduce((a, h) => a + sim.withVpp.steps[st].chg[h.id - 1], 0)
  const dis = enrolled.reduce((a, h) => a + sim.withVpp.steps[st].dis[h.id - 1], 0)

  // snake layout like the hand-drawn loop: row 1 → , row 2 ← , row 3 →
  const ORDER = [0, 1, 2, 5, 4, 3, 6, 7, 8]
  const ARROW = ['→', '→', '↓', '↓', '←', '←', '→', '→', '']
  const OM = ['order-1', 'order-2', 'order-3', 'order-4', 'order-5', 'order-6', 'order-7', 'order-8', 'order-9']
  const OS = ['sm:order-1', 'sm:order-2', 'sm:order-3', 'sm:order-4', 'sm:order-5', 'sm:order-6', 'sm:order-7', 'sm:order-8', 'sm:order-9']

  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-bold">How to reduce the load curve?</h3>
        <SimBadge />
        <div className="ml-auto flex gap-1">
          <button onClick={() => { if (ni >= NODES.length - 1) setNi(0); setPlay(p => !p) }} className="rounded-md bg-grid px-3 py-1 text-xs font-bold text-white hover:brightness-110">{play ? '❚❚ Pause' : '▶ Play the day'}</button>
        </div>
      </div>
      <p className="mb-3 text-xs text-dim">Click any step. The chart and numbers update for that time on DT-10 (100 kVA, {enrolled.length} enrolled batteries).</p>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* the loop */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
          {ORDER.map((idx, pos) => {
            const n = NODES[idx]
            const on = idx === ni, past = idx < ni
            return (
              <button key={n.k} onClick={() => { setPlay(false); setNi(idx) }}
                className={`relative flex min-h-[74px] items-center gap-2 rounded-lg border-2 p-2.5 text-left transition ${OM[idx]} ${OS[pos]} ${on ? 'ring-soft scale-[1.02]' : ''}`}
                style={{ background: n.c, borderColor: on ? '#1f6b45' : n.b, opacity: past || on ? 1 : 0.75 }}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-base font-bold text-fg shadow-sm">{n.icon}</span>
                <span className="grid">
                  <span className="text-[13px] font-bold leading-tight text-fg">{n.k}</span>
                  <span className="font-mono text-[11px] text-dim">{fmtHr(n.hr)}</span>
                </span>
                {ARROW[pos] && <span className={`pointer-events-none absolute hidden font-bold text-fgb sm:block ${ARROW[pos] === '↓' ? '-bottom-[17px] left-1/2 -translate-x-1/2' : ARROW[pos] === '←' ? '-left-[19px] top-1/2 -translate-y-1/2' : '-right-[19px] top-1/2 -translate-y-1/2'}`}>{ARROW[pos]}</span>}
              </button>
            )
          })}
        </div>

        {/* live chart + readout */}
        <div className="grid gap-2">
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="#eef2ee" vertical={false} />
                <XAxis dataKey="h" type="number" domain={[0, 24]} ticks={[0, 6, 12, 18, 24]} tickFormatter={v => `${v}:00`} tick={{ fontSize: 11, fill: '#6b7a70' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7a70' }} tickFormatter={v => `${v}%`} domain={[-60, 110]} ticks={[-50, 0, 50, 90, 100]} />
                <Tooltip formatter={(v, n) => [`${v}%`, n]} labelFormatter={v => fmtHr(v)} contentStyle={{ fontSize: 12 }} />
                <ReferenceArea x1={ev.activeStart / 4} x2={ev.activeEnd / 4} fill="#1f6b45" fillOpacity={0.06} />
                <ReferenceLine y={100} stroke="#b03a26" strokeDasharray="3 3" />
                <ReferenceLine y={90} stroke="#163a28" strokeDasharray="2 4" />
                <ReferenceLine y={0} stroke="#c3cec6" />
                <Area name="Before (without VPP)" dataKey="without" stroke={C_WITHOUT} strokeWidth={2} fill={C_WITHOUT} fillOpacity={0.07} dot={false} isAnimationActive={false} />
                <Line name="After (with FeederFleet)" dataKey="withVpp" stroke={C_WITH} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <ReferenceLine x={node.hr} stroke="#163a28" strokeWidth={1.5} label={{ value: fmtHr(node.hr), position: 'insideTopLeft', fontSize: 11, fill: '#163a28' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-dim">
            <span><span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: C_WITHOUT }} />Before: DT-10 loading, batteries self-use only</span>
            <span><span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: C_WITH }} />After: with FeederFleet</span>
            <span>% of 100 kVA rating · negative = reverse flow</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Read k={`DT-10 at ${fmtHr(node.hr)}`} v={`${d.without}% → ${d.withVpp}%`} />
            <Read k="Enrolled batteries" v={dis > 0.05 ? `−${dis.toFixed(1)} kW out` : chg > 0.05 ? `+${chg.toFixed(1)} kW in` : 'idle / hold'} />
            <Read k="Average SoC" v={`${Math.round(avgSoc * 100)}%`} />
            <Read k="Lowest above reserve" v={`${minAbove >= 0 ? '+' : ''}${Math.round(minAbove * 100)} pts`} good={minAbove >= -0.001} />
          </div>
          <div className="rounded-md bg-[#eef6f0] p-2.5 text-sm text-fgb">
            <b className="text-fg">Day result:</b> DT-10 evening peak <b style={{ color: C_WITHOUT }}>{peak0.toFixed(1)}%</b> → <b style={{ color: C_WITH }}>{peak1.toFixed(1)}%</b> of rating. No enrolled battery goes below its owner’s reserve at any time.
          </div>
        </div>
      </div>

      <FormulaRules sim={sim} />
    </div>
  )
}

const Read = ({ k, v, good }) => (
  <div className="rounded-md border border-line p-2">
    <div className="text-[10px] font-semibold uppercase tracking-wider text-dim">{k}</div>
    <div className={`font-mono text-sm font-bold ${good === false ? 'text-[#b03a26]' : 'text-fg'}`}>{v}</div>
  </div>
)

/* ───────────────────── formula rules (interactive) ───────────────────── */

function FormulaRules({ sim }) {
  const ev = sim.hero
  const h137 = sim.homes[136]
  const row = ev.match.rows.find(r => r.id === 137)
  const st = stepOf(MATCH_HR)
  const init = {
    cap: h137.battery.cap, soc: Math.round(sim.withVpp.steps[st].soc[136] * 100), reserve: Math.round(h137.battery.reserve * 100),
    pInv: h137.battery.maxDis, hours: ev.hours, pGrid: +(row?.allocKw || 2.5).toFixed(1),
  }
  const [v, setV] = useState(init)
  const set = (k, x) => setV(o => ({ ...o, [k]: x }))
  const eff = h137.battery.eff, floor = h137.battery.floor * 100
  const usableFrac = Math.max(0, v.soc - Math.max(v.reserve, floor)) / 100
  const eAvl = v.cap * usableFrac * eff
  const pBatt = eAvl / v.hours
  const terms = [['P_inverter', v.pInv], ['P_battery', pBatt], ['P_grid', v.pGrid]]
  const pAvl = Math.min(...terms.map(t => t[1]))
  const binding = terms.find(t => t[1] === pAvl)[0]
  const socAfter = v.soc - (pAvl * v.hours / eff / v.cap) * 100

  const S = ({ k, label, min, max, step, unit }) => (
    <label className="grid gap-0.5 text-xs text-fgb">
      <span className="flex justify-between"><span>{label}</span><b className="font-mono text-fg">{v[k]}{unit}</b></span>
      <input type="range" min={min} max={max} step={step} value={v[k]} onChange={e => set(k, +e.target.value)} className="accent-[#1f6b45]" />
    </label>
  )

  return (
    <div className="mt-4 rounded-lg border-2 border-dashed border-line p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded bg-[#f1f0fb] px-2 py-0.5 text-xs font-extrabold tracking-wider text-fg">FORMULA RULES IN THE VPP</span>
        <span className="text-xs text-dim">Move the sliders. Starts with home #137 at {fmtHr(MATCH_HR)} (simulated).</span>
        <button onClick={() => setV(init)} className="ml-auto rounded border border-line px-2 py-0.5 text-xs text-fgb hover:bg-panel2">Reset</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="grid gap-2">
          <div className="flex gap-2 text-xs">
            {[5, 10].map(c => (
              <button key={c} onClick={() => setV(o => ({ ...o, cap: c, pInv: c === 10 ? 5 : 3 }))} className={`rounded border px-2 py-1 font-semibold ${v.cap === c ? 'border-grid bg-grid text-white' : 'border-line text-fgb'}`}>{c} kWh battery · {c === 10 ? 5 : 3} kW inverter</button>
            ))}
          </div>
          <S k="soc" label="SoC — current state of charge" min={0} max={100} step={1} unit="%" />
          <S k="reserve" label="Owner backup reserve" min={10} max={90} step={5} unit="%" />
          <S k="hours" label="Event length" min={0.5} max={3} step={0.25} unit=" h" />
          <S k="pGrid" label="P_grid — what the DT needs from this home" min={0.5} max={6} step={0.1} unit=" kW" />
        </div>
        <div className="grid content-start gap-2 text-sm">
          <div className="rounded-md bg-panel2 p-2.5">
            <div className="font-semibold text-fg">Available energy</div>
            <div className="font-mono text-[13px] text-fgb">E_avl = C × (SoC − reserve) × η</div>
            <div className="font-mono text-[13px] text-fg">= {v.cap} × ({v.soc}% − {Math.max(v.reserve, floor)}%) × {eff} = <b>{eAvl.toFixed(2)} kWh</b></div>
            <div className="text-[11px] text-dim">C = battery capacity · η = discharge efficiency · reserve never below the BMS floor ({floor}%)</div>
          </div>
          <div className="rounded-md bg-panel2 p-2.5">
            <div className="font-semibold text-fg">Available dispatch power</div>
            <div className="font-mono text-[13px] text-fgb">P_avl = min(P_inverter, P_battery, P_grid)</div>
            <div className="mt-1 flex flex-wrap gap-1.5 font-mono text-[12px]">
              {terms.map(([n, x]) => (
                <span key={n} className={`rounded border px-1.5 py-0.5 ${n === binding ? 'border-grid bg-grid text-white' : 'border-line text-fgb'}`}>{n} {x.toFixed(2)} kW</span>
              ))}
            </div>
            <div className="mt-1 font-mono text-[13px] text-fg">P_avl = <b>{pAvl.toFixed(2)} kW</b> <span className="text-dim">(limited by {binding})</span></div>
            <div className="text-[11px] text-dim">P_battery = E_avl ÷ event length, so the battery lasts the whole event.</div>
          </div>
          <div className={`rounded-md p-2.5 ${pAvl < 0.8 ? 'bg-[#f6f6f4]' : 'bg-[#fff6d9]'}`}>
            {pAvl < 0.8
              ? <span className="text-fgb"><b className="text-fg">Not asked.</b> Less than 0.8 kW is available above the reserve, so this home is skipped (reserve protected).</span>
              : <span className="text-fgb">While maintaining <b className="text-fg">SoC ≥ reserve</b>: after the event SoC ≈ <b className="font-mono text-fg">{Math.round(socAfter)}%</b> (reserve {v.reserve}%) ✔</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
