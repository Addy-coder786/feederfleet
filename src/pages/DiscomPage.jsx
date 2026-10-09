import { useEffect, useMemo, useRef, useState } from 'react'
import { DT_RATING, DT_HOMES, N_DT, N_HOMES, dtLoadPct, PF } from '../sim/engine.js'
import { stepOf, fmtHr, runMatch, dtTone, alertsAt, DEFAULT_THRESHOLDS, availOf, homeEnergy, statusOf, STATUS_META, ENERGY_STATE, isOffline, VERDICT_NOTE, perHomeNote } from '../sim/model.js'
import { discomValue } from '../data/econ.js'
import { FEEDER_LABEL } from '../config/pilot.js'
import Ledger from '../components/Ledger.jsx'
import Term from '../components/Term.jsx'
import { SimBadge, PanelTitle, Kpi, Status, Tag } from '../components/ui.jsx'

const SNAPS = [['Midday', 53], ['Planning', 76], ['Evening peak', 87], ['Live demo', null]]
const TONE_LABEL = { green: ['green', 'Normal'], amber: ['amber', 'Watch'], red: ['red', 'Overload'] }

export default function DiscomPage({ sim, demo }) {
  const [snap, setSnap] = useState(76)
  const stepIdx = snap == null ? stepOf(demo.hour) : snap
  const step = sim.withVpp.steps[stepIdx]
  const [sel, setSel] = useState(9)
  const [req, setReq] = useState({ dt: 9, kind: 'support', kw: sim.hero.requiredKw, min: sim.hero.hours * 60, step: sim.hero.match.stepIdx, run: 1 })
  const [th, setTh] = useState(DEFAULT_THRESHOLDS)
  const matchRef = useRef(null)

  const fnet = step.feederNet
  const A = sim.metrics.without, B = sim.metrics.withVpp
  const online = sim.homes.filter(h => h.battery.controllable && !isOffline(h, stepIdx / 4))
  const flexKwh = online.reduce((a, h) => a + availOf(h, step), 0)
  const flexKw = online.reduce((a, h) => a + Math.min(h.battery.maxDis, availOf(h, step)), 0)
  const alerts = useMemo(() => alertsAt(sim, stepIdx, th), [sim, stepIdx, th])

  const dispatch = dt => {
    const ev = sim.events.find(e => e.dt === dt)
    setReq(r => ({ ...r, dt, kind: 'support', kw: ev ? ev.requiredKw : 10, min: ev ? ev.hours * 60 : 60, step: 76, run: r.run + 1 }))
    matchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-2xl font-extrabold">DISCOM control room</h2>
          <p className="text-sm text-dim">{FEEDER_LABEL} · {N_DT} <Term k="DT">DTs</Term> · {N_HOMES} homes · {sim.homes.filter(h => h.battery.controllable).length} VPP-controllable batteries · {sim.scenario.name}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex flex-wrap rounded-md border border-line bg-white p-0.5 text-xs font-semibold">
            {SNAPS.map(([l, s]) => (
              <button key={l} onClick={() => setSnap(s)} className={`rounded px-2.5 py-1.5 ${snap === s ? 'bg-grid text-white' : 'text-fgb hover:bg-panel2'}`}>
                {l}{s != null && <span className="ml-1 font-mono opacity-75">{fmtHr(s / 4)}</span>}
              </button>
            ))}
          </div>
          <SimBadge />
        </div>
      </div>

      {/* feeder status */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-white p-4 shadow-card sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label={`Feeder now · ${fmtHr(stepIdx / 4)}`} value={fnet < 0 ? `−${Math.abs(fnet).toFixed(0)}` : fnet.toFixed(0)} unit="kW" sub={fnet < 0 ? 'reverse flow to substation' : 'drawn from substation'} tone={fnet < -300 ? 'amber' : undefined} />
        <Kpi label="Reverse-flow peak today" value={`−${Math.abs(B.reverseKw).toFixed(0)}`} unit="kW" sub={`without VPP −${Math.abs(A.reverseKw).toFixed(0)} kW`} tone="amber" />
        <Kpi label="Evening peak today" value={B.peakKw.toFixed(0)} unit="kW" sub={`without VPP ${A.peakKw.toFixed(0)} kW`} />
        <Kpi label={<Term k="FLEX">Available flexibility</Term>} value={flexKw.toFixed(0)} unit="kW" sub={`${flexKwh.toFixed(0)} kWh · ${online.length} homes online`} />
        <Kpi label="Active alerts" value={alerts.length} sub={alerts.some(a => a.level === 'red') ? 'includes overload' : 'no overload now'} tone={alerts.some(a => a.level === 'red') ? 'red' : alerts.length ? 'amber' : undefined} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* where is the problem */}
        <div className="rounded-lg border border-line bg-white p-4 shadow-card">
          <PanelTitle kicker="Where is the problem?" title="Distribution transformers" right={<span className="text-[11px] text-dim">loading now · forecast peak without VPP</span>} />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: N_DT }, (_, d) => {
              const pct = dtLoadPct(step.dtNet[d], d)
              const fpk = Math.max(...sim.without.steps.map(s => dtLoadPct(s.dtNet[d], d)))
              const tone = dtTone(pct)
              const [st, lab] = TONE_LABEL[fpk > 100 && stepIdx < 90 && pct <= 100 ? 'red' : tone]
              return (
                <button key={d} onClick={() => setSel(d)}
                  className={`rounded-md border p-2.5 text-left transition hover:border-grid/50 ${sel === d ? 'border-grid ring-2 ring-grid/15' : 'border-line'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-fg">DT-{String(d + 1).padStart(2, '0')}</span>
                    <Status tone={st}>{fpk > 100 && pct <= 100 && stepIdx < 90 ? 'Forecast' : lab}</Status>
                  </div>
                  <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${tone === 'red' ? 'text-alert' : tone === 'amber' ? 'text-[#9a5f0a]' : 'text-fg'}`}>
                    {pct < 0 ? `−${Math.abs(pct).toFixed(0)}` : pct.toFixed(0)}<span className="text-sm font-normal text-dim">%</span>
                  </div>
                  <Spark sim={sim} d={d} now={stepIdx} />
                  <div className="mt-1 flex justify-between text-[11px] text-dim">
                    <span>{DT_RATING[d]} kVA · {DT_HOMES[d]} homes</span>
                    <span className={fpk > 100 ? 'font-semibold text-alert' : ''}>pk {fpk.toFixed(0)}%</span>
                  </div>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-dim">Loading % = kW ÷ (kVA rating × assumed power factor {PF}). Negative % = power flowing back through the DT (reverse flow). Cards turn amber above 90 % or when exporting more than 40 % of rating, red above 100 %.</p>
        </div>

        <DtDetail sim={sim} d={sel} stepIdx={stepIdx} onDispatch={dispatch} />
      </div>

      <div ref={matchRef} className="scroll-mt-20">
        <MatchingEngine sim={sim} req={req} setReq={setReq} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Thresholds th={th} setTh={setTh} alerts={alerts} stepIdx={stepIdx} />
        <ValueCard sim={sim} />
      </div>

      <div className="rounded-lg border border-line bg-white p-4 shadow-card">
        <PanelTitle kicker="Did they help? · settlement" title={`Settlement ledger — DT-${sim.hero.dt + 1} event, ${sim.scenario.dateLabel} (synthetic day)`} right={<SimBadge />} />
        <Ledger rows={eventLedger(sim)} />
      </div>
    </div>
  )
}

/** One row per controllable home on the event DT. Each home appears once → no double payment. */
export function eventLedger(sim) {
  const ev = sim.hero
  const date = sim.scenario.dateLabel
  const event = `DT-${ev.dt + 1} evening support`
  const ids = ev.match.rows.filter(r => r.controllable).map(r => r.id).sort((a, b) => a - b)
  return ids.map(id => {
    const p = ev.perHome.find(x => x.id === id)
    const r = ev.match.rows.find(x => x.id === id)
    if (p) return { date, event, home: id, kwh: p.deliveredKwh, status: 'verified', note: perHomeNote(p, fmtHr) }
    return { date, event, home: id, kwh: 0, status: r.verdict === 'offline' ? 'offline' : 'zero', note: VERDICT_NOTE[r.verdict] || '' }
  })
}

function Spark({ sim, d, now }) {
  const w = 120, h = 26
  const y = p => h / 2 - (p / 120) * (h / 2)
  const pts = scen => sim[scen].steps.map((s, t) => `${t ? 'L' : 'M'}${(t / 95 * w).toFixed(1)},${y(dtLoadPct(s.dtNet[d], d)).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-7 w-full" preserveAspectRatio="none">
      <line x1="0" x2={w} y1={y(0)} y2={y(0)} stroke="#dde6dd" />
      <line x1="0" x2={w} y1={y(100)} y2={y(100)} stroke="#e6aa9d" strokeDasharray="2 2" />
      <path d={pts('without')} fill="none" stroke="#b3541e" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.7" />
      <path d={pts('withVpp')} fill="none" stroke="#2f8f6b" strokeWidth="1.4" />
      <line x1={now / 95 * w} x2={now / 95 * w} y1="0" y2={h} stroke="#163a28" strokeWidth="0.8" />
    </svg>
  )
}

function DtDetail({ sim, d, stepIdx, onDispatch }) {
  const ev = sim.events.find(e => e.dt === d)
  const inDt = sim.homes.filter(h => h.dt === d)
  const ctrl = inDt.filter(h => h.battery.controllable)
  const elig = runMatch(sim, { dt: d, kind: 'support', requiredKw: ev?.requiredKw ?? 5, hours: ev?.hours ?? 1, stepIdx: Math.max(stepIdx, 1) })
  const eligibleNow = elig.rows.filter(r => r.verdict === 'ok').length
  const r = DT_RATING[d]
  const fpk = Math.max(...sim.without.steps.map(s => s.dtNet[d]))
  const wpk = Math.max(...sim.withVpp.steps.map(s => s.dtNet[d]))
  const cut = ev ? sim.without.steps[ev.forecastPeakStep].dtNet[d] - sim.withVpp.steps[ev.forecastPeakStep].dtNet[d] : 0
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <PanelTitle kicker="Who can help? · did they help?" title={`DT-${String(d + 1).padStart(2, '0')} · ${r} kVA`} right={ev ? <Status tone="red">Event {sim.scenario.dateLabel}</Status> : <Status tone="green">No event needed</Status>} />
      <dl className="grid grid-cols-2 gap-x-4 text-sm">
        {[
          ['Connected homes', inDt.length],
          ['VPP-controllable', ctrl.length],
          [`Eligible now (${fmtHr(stepIdx / 4)})`, eligibleNow],
          ['Monitor-only', inDt.length - ctrl.length],
          ['Peak without VPP', `${dtLoadPct(fpk, d).toFixed(0)}%`],
          ['Peak with VPP', `${dtLoadPct(wpk, d).toFixed(0)}%`],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-line/60 py-1.5"><dt className="text-dim">{k}</dt><dd className="font-mono font-semibold text-fg">{v}</dd></div>
        ))}
      </dl>
      {ev ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4 lg:grid-cols-2">
          <Box k="Requested" v={`${ev.requiredKw} kW`} s={`${fmtHr(ev.startStep / 4)}–${fmtHr(ev.endStep / 4)}`} />
          <Box k="Matched" v={`${ev.match.matchedKw.toFixed(1)} kW`} s={`${ev.perHome.length} homes`} />
          <Box k="Delivered at peak" v={`${cut.toFixed(1)} kW`} s={`${Math.round(100 * cut / ev.requiredKw)}% of request`} good />
          <Box k="Verified energy" v={`${ev.deliveredKwh.toFixed(1)} kWh`} s="above baseline" good />
          {ev.match.shortfallKw > 0.05 && <p className="col-span-full rounded-md border border-solar/40 bg-[#fdf6e6] p-2 text-left text-xs text-[#7a520c]"><b>Shortfall {ev.match.shortfallKw.toFixed(1)} kW at matching.</b> Not enough energy above owner reserves under this DT. Peak with VPP {dtLoadPct(ev.peakWithKw, d).toFixed(0)} % — flag for more enrolment, a voluntary AC nudge, or a DT upgrade. Reserves are never broken to close a gap.</p>}
          {ev.replans.map(rp => (
            <p key={rp.t} className="col-span-full rounded-md border border-line bg-panel2/60 p-2 text-left text-xs text-fgb">
              <b>Replan {fmtHr(rp.t / 4)}:</b> {rp.droppedIds.map(i => '#' + i).join(', ')} stopped responding (−{rp.lostKw.toFixed(1)} kW). State refreshed, matching re-run for the remaining {Math.round(rp.hoursLeft * 60)} min → {rp.added.length ? rp.added.map(a => `#${a.id} +${a.kw.toFixed(1)} kW`).join(', ') : <b>no eligible home left</b>}{rp.shortfallKw > 0.05 && ` · ${rp.shortfallKw.toFixed(1)} kW not replaced`}.
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md bg-panel2 p-3 text-sm text-fgb">Forecast stays below 100 % of rating, so no batteries are asked to help. The fleet under this DT stays in normal self-use.</p>
      )}
      <DtHomes sim={sim} d={d} stepIdx={stepIdx} />
      <button onClick={() => onDispatch(d)} className="mt-3 w-full rounded-md bg-grid py-2.5 text-sm font-bold text-white hover:brightness-110">
        {ev ? 'DISPATCH — open matching engine' : 'Test a request on this DT'}
      </button>
    </div>
  )
}
const Box = ({ k, v, s, good }) => (
  <div className={`rounded-md border p-2 ${good ? 'border-grid/30 bg-[#eef6f0]' : 'border-line bg-panel2/50'}`}>
    <div className="text-[10.5px] font-semibold uppercase tracking-wider text-dim">{k}</div>
    <div className="font-mono text-lg font-bold text-fg">{v}</div>
    <div className="text-[11px] text-dim">{s}</div>
  </div>
)

function MatchingEngine({ sim, req, setReq }) {
  const res = useMemo(() => runMatch(sim, { dt: req.dt, kind: req.kind, requiredKw: req.kw, hours: req.min / 60, stepIdx: req.step }), [sim, req])
  const [shown, setShown] = useState(0)
  useEffect(() => {
    setShown(0)
    const n = res.rows.length
    let k = 0
    const id = setInterval(() => { k += 1; setShown(k); if (k >= n) clearInterval(id) }, Math.max(35, 900 / n))
    return () => clearInterval(id)
  }, [res, req.run])
  const done = shown >= res.rows.length
  const V = {
    ok: ['✅', 'Selected', 'text-grid'], standby: ['○', 'Standby — eligible, not needed', 'text-grid'], reserve: ['❌', 'Reserve protected', 'text-dim'], low: ['❌', 'Too little energy above reserve', 'text-dim'],
    offline: ['❌', 'Offline — no heartbeat', 'text-alert'], monitor: ['—', 'Monitor-only (not controllable)', 'text-dim'], full: ['❌', 'Battery full — cannot absorb', 'text-[#9a5f0a]'],
  }
  const set = patch => setReq(r => ({ ...r, ...patch, run: r.run + 1 }))
  const rules = req.kind === 'support'
    ? ['Same DT', 'Controllable inverter', 'Online', 'Above owner reserve', 'Enough energy for the whole event']
    : ['Same DT', 'Controllable inverter', 'Online', 'Room to charge (not full)']
  const [showMon, setShowMon] = useState(false)
  const rows = res.rows.filter(r => showMon || r.verdict !== 'monitor')
  const monitorN = res.rows.filter(r => r.verdict === 'monitor').length
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <PanelTitle kicker="Automatic VPP matching engine" title="Who can safely help — and how much?" right={<SimBadge />} />
      <div className="flex flex-wrap items-end gap-3 rounded-md bg-panel2/70 p-3 text-sm">
        <Field l="Transformer">
          <select value={req.dt} onChange={e => set({ dt: +e.target.value })} className="inp">
            {Array.from({ length: N_DT }, (_, d) => <option key={d} value={d}>DT-{String(d + 1).padStart(2, '0')}</option>)}
          </select>
        </Field>
        <Field l="Request">
          <select value={req.kind} onChange={e => set(e.target.value === 'absorb' ? { kind: 'absorb', step: 48, kw: 10, min: 60 } : { kind: 'support', step: 76, kw: sim.hero.requiredKw, min: sim.hero.hours * 60 })} className="inp">
            <option value="support">Evening support (discharge)</option>
            <option value="absorb">Midday absorb (charge)</option>
          </select>
        </Field>
        <Field l="Power (kW)"><input type="number" min="1" max="60" value={req.kw} onChange={e => set({ kw: Math.max(1, +e.target.value || 1) })} className="inp w-20" /></Field>
        <Field l="Duration (min)">
          <select value={req.min} onChange={e => set({ min: +e.target.value })} className="inp">
            {[30, 60, 75, 90, 120].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field l="Decide at">
          <select value={req.step} onChange={e => set({ step: +e.target.value })} className="inp">
            {[44, 48, 52, 72, 76, 80].map(s => <option key={s} value={s}>{fmtHr(s / 4)}</option>)}
          </select>
        </Field>
        <button onClick={() => set({})} className="rounded-md bg-grid px-4 py-2 font-bold text-white hover:brightness-110">Run matching</button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        {rules.map(r => <span key={r} className="rounded border border-grid/25 bg-[#eef6f0] px-2 py-1 font-semibold text-grid">✔ {r}</span>)}
      </div>

      <div className="mt-3 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-wider text-dim">
                <th className="py-2 pr-3 font-semibold">Home</th><th className="pr-3 font-semibold">Battery</th><th className="pr-3 text-right font-semibold"><Term k="SOC">SoC</Term></th>
                <th className="pr-3 text-right font-semibold"><Term k="RESERVE">Reserve</Term></th><th className="pr-3 font-semibold">Online</th>
                <th className="pr-3 text-right font-semibold">Offer</th><th className="pr-3 text-right font-semibold">Allocated</th><th className="font-semibold">Decision</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r, k) => {
                const idx = res.rows.indexOf(r)
                if (idx >= shown) return null
                const [ic, lab, cls] = V[r.verdict]
                return (
                  <tr key={r.id} className={`fadein border-b border-line/60 ${r.verdict === 'ok' ? 'bg-[#f3f9f4]' : ''}`}>
                    <td className="py-1.5 pr-3 font-mono font-semibold text-fg">#{r.id}</td>
                    <td className="pr-3 text-xs text-fgb">{r.cap} kWh {r.type === 'li' ? `Li · ${r.maxDis} kW` : 'lead-acid'}</td>
                    <td className="pr-3 text-right font-mono">{Math.round(r.soc * 100)}%</td>
                    <td className="pr-3 text-right font-mono">{Math.round(r.reserve * 100)}%</td>
                    <td className="pr-3">{r.controllable ? (r.online ? '✔' : <span className="text-alert">✕</span>) : '—'}</td>
                    <td className="pr-3 text-right font-mono">{r.offerKw ? `${r.offerKw.toFixed(1)} kW` : '—'}</td>
                    <td className="pr-3 text-right font-mono font-semibold text-fg">{r.allocKw ? `${r.allocKw.toFixed(1)} kW` : '—'}</td>
                    <td className={`text-xs font-semibold ${cls}`}>{ic} {lab}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {monitorN > 0 && (
            <button onClick={() => setShowMon(v => !v)} className="mt-2 text-xs font-semibold text-grid hover:underline">
              {showMon ? 'Hide' : 'Show'} {monitorN} monitor-only batteries on this DT
            </button>
          )}
        </div>
        <div className={`rounded-md border p-3 ${done ? (res.shortfallKw > 0.05 ? 'border-solar/40 bg-[#fdf6e6]' : 'border-grid/30 bg-[#eef6f0]') : 'border-line bg-panel2/60'}`}>
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-dim">{done ? 'Result' : 'Matching…'}</div>
          <div className="mt-1 font-mono text-sm text-fgb">Required <b className="text-fg">{req.kw} kW</b> for {req.min} min</div>
          <div className="font-mono text-2xl font-bold text-fg">{done ? `${res.matchedKw.toFixed(1)} kW` : '…'}</div>
          <div className="text-xs text-dim">matched from {res.rows.filter(r => r.allocKw > 0).length} homes · local merit order (biggest safe offer first) until request + 10 % margin</div>
          {done && res.shortfallKw > 0.05 && (
            <p className="mt-2 text-xs text-[#7a520c]"><b>Shortfall {res.shortfallKw.toFixed(1)} kW.</b> {req.kind === 'support'
              ? 'Next: voluntary AC-nudge in this DT area, or accept the overload and flag the DT for upgrade. Reserves are never broken to close a gap.'
              : 'Next: flexible loads (water heating, pumps), then export limiting as the last resort.'}</p>
          )}
          {done && res.shortfallKw <= 0.05 && <p className="mt-2 text-xs text-grid">Covered. Setpoints go to each home gateway; delivery is verified after the event.</p>}
        </div>
      </div>
    </div>
  )
}
const Field = ({ l, children }) => <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wider text-dim">{l}{children}</label>

function Thresholds({ th, setTh, alerts, stepIdx }) {
  const F = [
    ['exportKw', 'Home export above', 'kW', 0.5, 5, 0.5],
    ['exportMin', '…for longer than', 'min', 15, 120, 15],
    ['dtPct', 'DT loading above', '%', 70, 110, 5],
    ['reversePct', 'DT reverse flow above', '% of rating', 20, 80, 5],
    ['heartbeat', 'Missed heartbeats', 'cycles', 1, 8, 1],
  ]
  const lv = { red: 'red', amber: 'amber', grey: 'grey' }
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <PanelTitle kicker="Surplus / deficit detection" title={`Threshold alerts · ${fmtHr(stepIdx / 4)}`} />
      <div className="grid gap-2 sm:grid-cols-2">
        {F.map(([k, l, u, mn, mx, st]) => (
          <label key={k} className="flex items-center justify-between gap-2 rounded-md border border-line px-2.5 py-1.5 text-xs">
            <span className="text-fgb">{l}</span>
            <span className="flex items-center gap-1"><input type="number" min={mn} max={mx} step={st} value={th[k]} onChange={e => setTh(t => ({ ...t, [k]: +e.target.value }))} className="inp w-16 py-1 text-right" /><span className="text-dim">{u}</span></span>
          </label>
        ))}
      </div>
      <ul className="mt-3 grid gap-1.5">
        {alerts.length === 0 && <li className="text-sm text-dim">No alerts at this time.</li>}
        {alerts.map((a, k) => (
          <li key={k} className="flex items-center gap-2 text-sm"><Status tone={lv[a.level]}>{a.kind}</Status><span className="text-fgb">{a.text}</span></li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-dim">Each home is also tagged ☀️ Surplus / ⚖️ Balanced / 🔴 Deficit from its own meter every 15 min (see the Community map filters).</p>
    </div>
  )
}

function ValueCard({ sim }) {
  const v = discomValue(sim.hero, sim.homes.filter(h => h.dt === sim.hero.dt && h.battery.controllable).length)
  const Col = ({ k, rows, total, good }) => (
    <div className={`rounded-md border p-2.5 ${good ? 'border-grid/30 bg-[#eef6f0]' : 'border-line'}`}>
      <div className="flex justify-between text-[10.5px] font-semibold uppercase tracking-wider text-dim"><span>{k}</span><span className="font-mono text-fg">₹{total.toLocaleString('en-IN')}</span></div>
      <ul className="mt-1 grid gap-1">
        {rows.map(([l, n, t, note]) => (
          <li key={l} className="text-[11.5px] leading-snug">
            <div className="flex justify-between gap-2"><span className="text-fgb">{l}</span><span className="font-mono text-fg">₹{n.toLocaleString('en-IN')}</span></div>
            <div className="flex flex-wrap items-center gap-1 text-[10.5px] text-dim"><Tag t={t} />{note}</div>
          </li>
        ))}
      </ul>
    </div>
  )
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <PanelTitle kicker="What the DISCOM gets" title={`Value at one stressed DT (DT-${sim.hero.dt + 1}), per year`} right={<Tag t="ESTIMATE" />} />
      <div className="grid gap-2 sm:grid-cols-3">
        <Col k="Gets" rows={v.gets} total={v.getsT} good />
        <Col k="Pays homeowners" rows={v.pays} total={v.paysT} />
        <Col k="Spends" rows={v.spends} total={v.spendsT} />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-md bg-[#eef6f0] px-3 py-2">
        <span className="text-sm font-semibold text-fg">Net per stressed DT</span>
        <span className="font-mono text-lg font-bold text-grid">≈ {v.net >= 0 ? '+' : '−'}₹{Math.abs(v.net).toLocaleString('en-IN')}/yr</span>
      </div>
      <ul className="mt-2 grid gap-1 text-xs text-fgb">
        {v.notes.map(n => <li key={n} className="flex gap-1.5"><span className="text-dim">•</span>{n}</li>)}
      </ul>
    </div>
  )
}

function DtHomes({ sim, d, stepIdx }) {
  const [all, setAll] = useState(false)
  const step = sim.withVpp.steps[stepIdx]
  const hr = stepIdx / 4
  const homes = sim.homes.filter(h => h.dt === d).sort((a, b) => (b.battery.controllable - a.battery.controllable) || a.id - b.id)
  const list = all ? homes : homes.filter(h => h.battery.controllable)
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center text-[10.5px] font-semibold uppercase tracking-wider text-dim">
        Local homes · {fmtHr(hr)}
        <button onClick={() => setAll(v => !v)} className="ml-auto normal-case tracking-normal text-grid hover:underline">{all ? 'Controllable only' : `Show all ${homes.length}`}</button>
      </div>
      <div className="max-h-56 overflow-y-auto rounded-md border border-line">
        <table className="w-full text-xs tabular-nums">
          <thead className="sticky top-0 bg-panel2 text-left text-[10px] uppercase tracking-wider text-dim">
            <tr><th className="px-2 py-1 font-semibold">Home</th><th className="font-semibold">Solar</th><th className="font-semibold">Load</th><th className="font-semibold">SoC / res.</th><th className="font-semibold">State</th></tr>
          </thead>
          <tbody>
            {list.map(h => {
              const e = homeEnergy(sim, h, stepIdx)
              const st = statusOf(h, step, hr)
              return (
                <tr key={h.id} className="border-t border-line/60">
                  <td className="px-2 py-1 font-mono font-semibold text-fg">#{h.id}</td>
                  <td className="font-mono">{e.pv.toFixed(1)}</td>
                  <td className="font-mono">{e.load.toFixed(1)}</td>
                  <td className="font-mono">{Math.round(e.soc * 100)}% / {Math.round(h.battery.reserve * 100)}%</td>
                  <td><span className="font-semibold" style={{ color: STATUS_META[st].color === '#c3cec6' ? '#6b7a70' : STATUS_META[st].color }}>{STATUS_META[st].label}</span> <span title={ENERGY_STATE[e.state].label}>{ENERGY_STATE[e.state].icon}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
