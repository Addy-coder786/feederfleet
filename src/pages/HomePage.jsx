import { useMemo, useState } from 'react'
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ReferenceArea } from 'recharts'
import { offlineSince } from '../sim/engine.js'
import { stepOf, fmtHr, homeEnergy, homeSeries, ENERGY_STATE, availOf, VERDICT_NOTE, perHomeNote } from '../sim/model.js'
import { PILOT } from '../config/pilot.js'
import { payFor, RATE_PER_KWH, RETAINER_YR } from '../data/econ.js'
import Ledger from '../components/Ledger.jsx'
import Term from '../components/Term.jsx'
import { SimBadge, PanelTitle, Kpi } from '../components/ui.jsx'

// validated three-series palette on white: solar / consumption / battery
const C_SOLAR = '#d09a2a', C_LOAD = '#b3541e', C_BATT = '#2f8f6b'
const TIMES = [['Midday', 52], ['Event', 87], ['End of day', 95], ['Live demo', null]]
// SYNTHETIC EXAMPLES of earlier evenings (not simulated days, not payments): today's verified kWh × a
// factor, to show what a statement could look like. Marked EXAMPLE in the ledger and excluded from totals.
const HISTORY = [
  { ago: 3, f: 1.06 },
  { ago: 6, f: 0.58, note: 'example of a partial event — 35 min telemetry gap counted as zero' },
  { ago: 9, f: 0.93 },
  { ago: 13, f: 1.11 },
]
const STORY_HOMES = [137, 58, 17, 41, 229, 312, 141, 204]

export default function HomePage({ sim, homeId, setHomeId, demo, setReserve }) {
  const [tSel, setTSel] = useState(95)
  const stepIdx = tSel == null ? stepOf(demo.hour) : tSel
  const hr = stepIdx / 4
  const h = sim.homes[homeId - 1]
  const b = h.battery
  const step = sim.withVpp.steps[stepIdx]
  const e = homeEnergy(sim, h, stepIdx)
  const es = ENERGY_STATE[e.state]
  const series = useMemo(() => homeSeries(sim, h), [sim, h])
  const ev = sim.events.find(x => x.dt === h.dt)
  const mine = ev?.perHome.find(p => p.id === h.id)
  const row = ev?.match.rows.find(r => r.id === h.id)
  const evEnd = ev ? ev.activeEnd / 4 : 0
  const upto = series.filter(p => p.h <= hr)
  const sum = f => upto.reduce((a, p) => a + f(p) * 0.25, 0)
  const doneEvent = mine && hr >= evEnd
  const todayKwh = doneEvent ? mine.deliveredKwh : 0
  const minSoc = mine ? Math.min(...sim.withVpp.steps.slice(ev.activeStart, ev.activeEnd).map(s => s.soc[h.id - 1])) : null

  const ledgerRows = !b.controllable ? [] : [
    mine ? { date: sim.scenario.dateLabel, event: `DT-${h.dt + 1} evening support`, kwh: mine.deliveredKwh, status: doneEvent ? 'verified' : 'pending', note: doneEvent ? perHomeNote(mine, fmtHr) : 'event tonight — verified after it ends' }
      : row ? { date: sim.scenario.dateLabel, event: `DT-${h.dt + 1} evening support`, kwh: 0, status: row.verdict === 'offline' ? 'offline' : 'zero', note: VERDICT_NOTE[row.verdict] || '' }
      : null,
    ...(mine ? HISTORY.map(r => ({ date: `day −${r.ago}`, event: `DT-${h.dt + 1} evening support`, kwh: mine.deliveredKwh * r.f, status: 'example', note: r.note || 'synthetic example row' })) : []),
  ].filter(Boolean)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-mono text-2xl font-extrabold">HOME #{h.id}</h2>
          <p className="text-sm text-dim">
            DT-{h.dt + 1} · phase {h.phase} · {h.kwp > 0 ? `${h.kwp.toFixed(1)} kWp solar · ` : 'no solar · '}
            {b.cap} kWh {b.type === 'li' ? 'Li-ion' : 'lead-acid'} · {b.controllable ? `${b.maxDis} kW hybrid inverter + gateway` : 'inverter UPS (monitor-only)'}
          </p>
        </div>
        <span className="rounded px-2.5 py-1 text-xs font-bold" style={{ background: es.bg, color: es.color }}>
          {es.icon} {es.label.toUpperCase()} {e.net >= 0 ? '+' : '−'}{Math.abs(e.net).toFixed(1)} kW
        </span>
        <span className="rounded bg-[#e6f2ea] px-2.5 py-1 text-xs font-bold text-grid">🛡 Backup reserve protected · {Math.round(b.reserve * 100)}%</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select value={homeId} onChange={e => setHomeId(+e.target.value)} className="inp" aria-label="Choose home">
            {STORY_HOMES.map(id => <option key={id} value={id}>Home #{id}</option>)}
            {!STORY_HOMES.includes(homeId) && <option value={homeId}>Home #{homeId}</option>}
          </select>
          <div className="flex flex-wrap rounded-md border border-line bg-white p-0.5 text-xs font-semibold">
            {TIMES.map(([l, s]) => (
              <button key={l} onClick={() => setTSel(s)} className={`rounded px-2.5 py-1.5 ${tSel === s ? 'bg-grid text-white' : 'text-fgb hover:bg-panel2'}`}>
                {l}{s != null && <span className="ml-1 font-mono opacity-75">{fmtHr(Math.min(23.75, s / 4))}</span>}
              </button>
            ))}
          </div>
          <SimBadge />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-white p-4 shadow-card sm:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Solar now" value={e.pv.toFixed(1)} unit="kW" sub={`${sum(p => p.solar).toFixed(1)} kWh today`} />
        <Kpi label="Consumption now" value={e.load.toFixed(1)} unit="kW" sub={`${sum(p => p.load).toFixed(1)} kWh today`} />
        <Kpi label={<Term k="SOC">Battery</Term>} value={Math.round(e.soc * 100)} unit="%" sub={`${(e.soc * b.cap).toFixed(1)} of ${b.cap} kWh`} />
        <Kpi label={<Term k="RESERVE">Protected reserve</Term>} value={Math.round(b.reserve * 100)} unit="%" sub={`${(b.reserve * b.cap).toFixed(1)} kWh kept for outages`} />
        <Kpi label={<Term k="FLEX">VPP available</Term>} value={b.controllable ? availOf(h, step).toFixed(1) : '—'} unit={b.controllable ? 'kWh' : ''} sub="above reserve, after losses" />
        <Kpi label="Today's VPP support" value={todayKwh.toFixed(2)} unit="kWh" sub={mine ? (doneEvent ? 'verified' : 'event pending') : 'not dispatched'} />
        <Kpi label="Today's payment" value={`₹${payFor(todayKwh).toFixed(2)}`} sub={`₹${RATE_PER_KWH}/verified kWh (illustrative)`} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-line bg-white p-4 shadow-card">
          <PanelTitle kicker="Generation vs consumption" title="Today, 24 hours (kW)" right={<span className="text-[11px] text-dim">battery: above 0 = charging, below 0 = discharging</span>} />
          <div className="h-[320px]">
            <ResponsiveContainer>
              <ComposedChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="#e7ede7" strokeDasharray="2 4" vertical={false} />
                {ev && <ReferenceArea x1={ev.activeStart / 4} x2={ev.activeEnd / 4} fill="#cfe6d6" fillOpacity={0.5}
                  label={{ value: 'VPP event', position: 'insideTop', fill: '#1f6b45', fontSize: 11 }} />}
                <XAxis dataKey="h" type="number" domain={[0, 24]} ticks={[0, 3, 6, 9, 12, 15, 18, 21, 24]} tickFormatter={v => `${v}:00`} stroke="#c9d6ca" tick={{ fill: '#6b7a70', fontSize: 11 }} />
                <YAxis stroke="#c9d6ca" tick={{ fill: '#6b7a70', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #dde6dd', borderRadius: 6, fontSize: 12 }}
                  formatter={(v, n) => [`${v} kW`, n]} labelFormatter={fmtHr} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#9fb3a4" />
                <Area name="Solar" dataKey="solar" stroke={C_SOLAR} strokeWidth={2} fill={C_SOLAR} fillOpacity={0.12} isAnimationActive={false} />
                <Line name="House consumption" dataKey="load" stroke={C_LOAD} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line name="Battery activity" dataKey="battery" stroke={C_BATT} strokeWidth={2} dot={false} isAnimationActive={false} />
                <ReferenceLine x={hr} stroke="#163a28" strokeDasharray="3 3" label={{ value: 'now', position: 'top', fill: '#163a28', fontSize: 11 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-4">
          <FlowCard e={e} />
          {b.controllable && <OwnerControls h={h} setReserve={setReserve} />}
          <div className="rounded-lg border border-line bg-white p-4 shadow-card">
            <PanelTitle kicker="Latest VPP event" title={ev ? `DT-${h.dt + 1} evening support · ${fmtHr(ev.activeStart / 4)}–${fmtHr(ev.activeEnd / 4)}` : 'No event on this DT'} />
            {mine ? (
              <>
                <dl className="grid grid-cols-2 gap-x-4 text-sm">
                  {[
                    ['Requested', `${mine.committedKw.toFixed(1)} kW`],
                    ['Delivered (avg)', `${mine.actualKw.toFixed(2)} kW`],
                    [<Term k="BASELINE" key="b">Baseline</Term>, `${mine.baselineKw.toFixed(2)} kW`],
                    ['Duration', `${((ev.activeEnd - ev.activeStart) / 4).toFixed(2)} h`],
                  ].map(([k, v], i) => <div key={i} className="flex justify-between border-b border-line/60 py-1.5"><dt className="text-dim">{k}</dt><dd className="font-mono font-semibold text-fg">{v}</dd></div>)}
                </dl>
                <div className="mt-2 rounded-md bg-panel2/70 p-2.5 font-mono text-xs text-fgb">
                  ({mine.actualKw.toFixed(2)} − {mine.baselineKw.toFixed(2)}) kW × {((ev.activeEnd - ev.activeStart) / 4).toFixed(2)} h = <b className="text-fg">{mine.deliveredKwh.toFixed(2)} kWh</b>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className={`text-sm font-bold ${doneEvent ? 'text-grid' : 'text-[#7a520c]'}`}>{doneEvent ? 'Verified ✅ (meter cross-check)' : 'Pending — verified after the event'}</span>
                  <span className="font-mono text-xl font-bold text-fg">₹{payFor(mine.deliveredKwh).toFixed(2)}</span>
                </div>
                {perHomeNote(mine, fmtHr) && <p className="mt-2 rounded-md bg-[#fdf6e6] p-2 text-xs text-[#7a520c]">{perHomeNote(mine, fmtHr)}</p>}
                <p className="mt-2 text-xs text-grid">🛡 Backup reserve protected — lowest charge during the event: {Math.round(minSoc * 100)}% (reserve {Math.round(b.reserve * 100)}%).</p>
              </>
            ) : (
              <p className="text-sm text-fgb">
                {row?.verdict === 'reserve' && <>Not dispatched: you keep {Math.round(b.reserve * 100)}% for backup, so the VPP did not ask this battery to help. ₹0 for tonight; the availability retainer still applies.</>}
                {row?.verdict === 'standby' && <>Eligible but on standby tonight — the request was covered by other homes. You are called automatically if a selected home drops out. The availability retainer still applies.</>}
                {row?.verdict === 'low' && <>Not dispatched: too little energy above your reserve for the whole event. ₹0 for tonight; the availability retainer still applies.</>}
                {row?.verdict === 'offline' && <>Gateway offline since {fmtHr(offlineSince(h.id) ?? 19)}. The inverter fell back to normal self-use; delivery is counted as zero. No penalty.</>}
                {!b.controllable && <>This battery is monitor-only (inverter UPS). The VPP can see it but cannot control it, so it never receives requests.</>}
                {b.controllable && !row && <>No VPP event on this transformer today.</>}
              </p>
            )}
          </div>
        </div>
      </div>

      {b.controllable && (
        <div className="rounded-lg border border-line bg-white p-4 shadow-card">
          <PanelTitle kicker="Transaction history" title="VPP flexibility payments" right={<SimBadge />} />
          <Ledger rows={ledgerRows} showHome={false}
            footer={<>Paid only for <b>verified battery flexibility</b> (actual − baseline, cross-checked with the smart meter) at ₹{RATE_PER_KWH}/kWh, an illustrative pilot rate, plus a ₹{RETAINER_YR}/yr availability retainer. Your <Term k="NETMETER">solar export credit</Term> is unchanged and settled separately on your {PILOT.utility.short} bill. Rows marked EXAMPLE are synthetic illustrations, not payments, and are not in the total.</>} />
        </div>
      )}
    </div>
  )
}

function FlowCard({ e }) {
  // live power-flow diagram: solar, battery, grid around the home
  const battKw = e.chg - e.dis
  const grid = -e.net
  const N = [
    { k: 'Solar', v: e.pv, x: 60, y: 34, c: '#d09a2a', on: e.pv > 0.05, dir: 'in' },
    { k: 'Battery', v: Math.abs(battKw), x: 60, y: 146, c: '#2f8f6b', on: Math.abs(battKw) > 0.05, dir: battKw > 0 ? 'in' : 'out', note: battKw > 0.05 ? 'charging' : battKw < -0.05 ? 'discharging' : 'idle' },
    { k: 'Grid', v: Math.abs(grid), x: 260, y: 90, c: '#51695c', on: Math.abs(grid) > 0.05, dir: grid > 0 ? 'out' : 'in', note: grid > 0.05 ? 'importing' : grid < -0.05 ? 'exporting' : 'balanced' },
  ]
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <PanelTitle kicker="Power flow now" title="Solar · home · battery · grid" />
      <svg viewBox="0 0 320 180" className="w-full">
        <g transform="translate(160,90)">
          <rect x="-34" y="-26" width="68" height="52" rx="6" fill="#fbfaf4" stroke="#9fb0a4" />
          <text y="-4" textAnchor="middle" fontSize="12" fontWeight="700" fill="#163a28">Home</text>
          <text y="13" textAnchor="middle" fontSize="12" fontFamily="IBM Plex Mono" fill="#b3541e">{e.load.toFixed(1)} kW</text>
        </g>
        {N.map(n => {
          const from = n.dir === 'in' ? [n.x, n.y] : [160, 90]
          const to = n.dir === 'in' ? [160, 90] : [n.x, n.y]
          return (
            <g key={n.k}>
              <line x1={n.x} y1={n.y} x2={160} y2={90} stroke={n.on ? n.c : '#dde6dd'} strokeWidth={n.on ? 2.5 : 1.5} />
              {n.on && <circle r="4" fill={n.c} className="particle" style={{ offsetPath: `path('M${from[0]},${from[1]} L${to[0]},${to[1]}')`, '--dur': '1.8s' }} />}
              <circle cx={n.x} cy={n.y} r="24" fill="#ffffff" stroke={n.on ? n.c : '#dde6dd'} strokeWidth="2" />
              <text x={n.x} y={n.y - 3} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#163a28">{n.k}</text>
              <text x={n.x} y={n.y + 11} textAnchor="middle" fontSize="10.5" fontFamily="IBM Plex Mono" fill="#2f4a3b">{n.v.toFixed(1)}</text>
              {n.note && <text x={n.x} y={n.y + 38} textAnchor="middle" fontSize="10" fill="#6b7a70">{n.note}</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function OwnerControls({ h, setReserve }) {
  const [draft, setDraft] = useState(null)
  const val = draft ?? h.battery.reserve
  const commit = v => { setDraft(null); setReserve(h.id, v) }
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <PanelTitle kicker="Your controls" title="Backup reserve" right={<span className="font-mono text-lg font-bold text-fg">{Math.round(val * 100)}%</span>} />
      <input type="range" min={0.3} max={0.9} step={0.05} value={val} aria-label="Backup reserve"
        onChange={e => setDraft(+e.target.value)} onMouseUp={e => commit(+e.target.value)} onTouchEnd={e => commit(+e.target.value)} onKeyUp={e => commit(+e.target.value)}
        className="timebar w-full" />
      <p className="mt-2 text-xs text-fgb">The VPP never uses energy below this line. A higher reserve means fewer or no requests — the matcher re-runs and calls another home instead. You can also opt out of any single event, or leave the programme, at any time.</p>
    </div>
  )
}
