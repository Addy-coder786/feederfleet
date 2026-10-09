import { useMemo, useState } from 'react'
import CommunityMap, { W, VB_Y, VB_H } from '../components/CommunityMap.jsx'
import { DT_RATING, DT_HOMES, SPECIAL, N_HOMES, dtLoadPct, EVENT_TARGET, offlineSince, PF } from '../sim/engine.js'
import { FEEDER_LABEL, SIM_DISCLAIMER } from '../config/pilot.js'
import { stepOf, fmtHr, homeEnergy, statusOf, STATUS_META, ENERGY_STATE, availOf, dtTone } from '../sim/model.js'
import { DEMO_LEN, phaseAt, TONES, FLOW, flowIdx, secAt, hourAt } from '../story.js'
import { payFor, RATE_PER_KWH } from '../data/econ.js'
import Term from '../components/Term.jsx'
import { SimBadge } from '../components/ui.jsx'
import VppInterface from '../components/VppInterface.jsx'

const FILTERS = [
  ['all', 'All'], ['surplus', '☀️ Surplus'], ['deficit', '🔴 Deficit'], ['charging', 'Charging'],
  ['discharging', 'VPP discharging'], ['reserve', 'Reserve protected'], ['offline', 'Offline'],
]
const STORY_ORDER = [17, 41, 58, 137, 141, 204, 229, 312]
const REVEAL0 = 24.4, REVEAL_DT = 0.8

export default function CommunityPage({ sim, demo, onOpenHome, setReserve, resetReserves, overrides }) {
  const { sec, hour, started } = demo
  const stepIdx = stepOf(hour)
  const step = sim.withVpp.steps[stepIdx]
  const ev = sim.hero
  const phase = phaseAt(sec)
  const tone = started ? TONES[phase.tone] : TONES.green
  const [filter, setFilter] = useState('all')
  const [hover, setHover] = useState(null)
  const [picked, setPicked] = useState(null)

  const rowById = useMemo(() => Object.fromEntries(ev.match.rows.map(r => [r.id, r])), [ev])
  const eligible = useMemo(() => ev.match.rows.filter(r => r.allocKw > 0), [ev])
  const fpkPct = Math.round(dtLoadPct(ev.forecastPeakKw, ev.dt))
  const fpkHr = fmtHr(ev.forecastPeakStep * 0.25)

  // ---- story state ----
  const on = (a, b) => started && sec >= a && sec < b
  const verdicts = {}
  if (on(REVEAL0, 45)) {
    STORY_ORDER.forEach((id, k) => {
      if (sec < REVEAL0 + k * REVEAL_DT) return
      const r = rowById[id]
      verdicts[id] = r.verdict === 'ok' ? { ok: true, text: `✓ ${r.allocKw.toFixed(1)} kW` }
        : r.verdict === 'standby' ? { col: '#1f6b45', text: '○ Standby' }
        : r.verdict === 'reserve' ? { col: '#6b7a70', text: '✕ Reserve protected' }
        : r.verdict === 'offline' ? { col: '#9b3322', text: '✕ Offline' }
        : { col: '#6b7a70', text: `✕ ${r.reason}` }
    })
  }
  const supportIds = on(30.4, 52) ? new Set(eligible.map(r => r.id)) : null
  const requestedIds = on(32, 45) ? new Set(eligible.map(r => r.id)) : null
  const dataLinks = on(29.6, 36) ? eligible.map(r => r.id) : null

  const wo = dtLoadPct(sim.without.steps[stepIdx].dtNet[ev.dt], ev.dt)
  const wi = dtLoadPct(step.dtNet[ev.dt], ev.dt)
  const dtDisplay = {}
  if (on(15.5, 35)) dtDisplay[ev.dt] = { pct: wi, tone: dtTone(wi), forecast: `⚠ Forecast ${fpkPct}% at ${fpkHr}` }
  else if (on(35, 52)) {
    const r = Math.min(1, (sec - 35) / 3)
    const shown = Math.max(wo, 100.5) + (wi - Math.max(wo, 100.5)) * r // start from the red forecast state, settle on the real value
    dtDisplay[ev.dt] = { pct: shown, tone: dtTone(shown), ghost: wo > wi + 1.5 ? `without VPP: ${wo.toFixed(0)}%` : null }
  }
  const callouts = on(6.5, 15) ? [{ id: SPECIAL.FULL, text: `#${SPECIAL.FULL} battery full — can’t absorb more` }] : []
  const vppLabel = sec < 24 ? 'finding flexibility…' : sec < 32 ? `matching homes · DT-${ev.dt + 1}` : sec < 45 ? `dispatching · DT-${ev.dt + 1}` : sec < 52 ? 'verifying delivery' : sec < 57 ? 'settling payments' : 'replanning for tomorrow'

  // counts across ALL simulated homes for the filter chips
  const counts = useMemo(() => {
    const c = { all: N_HOMES, surplus: 0, deficit: 0, charging: 0, discharging: 0, reserve: 0, offline: 0 }
    sim.homes.forEach(h => {
      const e = homeEnergy(sim, h, stepIdx); const st = statusOf(h, step, hour)
      if (e.state === 'surplus') c.surplus++; if (e.state === 'deficit') c.deficit++
      if (c[st] != null && st !== 'all') c[st]++
    })
    return c
  }, [sim, stepIdx, hour, step])

  const A = sim.metrics.without, B = sim.metrics.withVpp
  const s137 = sim.settlement
  const card = picked || hover

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
      {/* hero strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <h1 className="font-display text-[26px] font-extrabold leading-none tracking-tight text-fg sm:text-[30px]">FEEDERFLEET</h1>
        <div className="min-w-0 flex-1 basis-[260px] border-l-2 border-line pl-4">
          <p className="text-[15px] font-semibold leading-snug text-fg">Turn distributed home batteries into feeder flexibility.</p>
          <p className="text-[13px] leading-snug text-fgb">Find the batteries that can safely help the grid — right where the network needs them.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="hidden text-xs text-dim lg:inline">{FEEDER_LABEL} — simulated</span>
          <button onClick={demo.running ? demo.pause : demo.start}
            className="rounded-md bg-grid px-5 py-2.5 text-sm font-bold text-white shadow-card transition hover:brightness-110">
            {demo.running ? '❚❚ Pause' : !started || sec >= DEMO_LEN ? '▶ Start demo' : '▶ Resume'}
          </button>
          <button onClick={demo.restart} className="rounded-md border border-line bg-white px-3.5 py-2.5 text-sm font-semibold text-fg hover:border-grid/40">↻ Restart</button>
        </div>
      </div>

      <FlowStrip sec={started ? sec : -1} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        {/* map card */}
        <div className="overflow-hidden rounded-lg border bg-white shadow-card transition-colors duration-700" style={{ borderColor: tone.ring }}>
          <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2">
            {FILTERS.map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition ${filter === k ? 'bg-grid text-white' : 'text-fgb hover:bg-panel2'}`}>
                {l} <span className={`font-mono ${filter === k ? 'text-white/80' : 'text-dim'}`}>{counts[k]}</span>
              </button>
            ))}
            <span className="ml-auto text-[11px] text-dim">34 of {N_HOMES} simulated homes drawn</span>
          </div>

          <div className="relative">
            <CommunityMap sim={sim} hour={hour} stepIdx={stepIdx} trunkTone={started ? phase.tone : 'green'}
              showVpp={started && sec >= 20} vppLabel={vppLabel} scanning={on(20, 24.4)} verdicts={verdicts}
              supportIds={supportIds} requestedIds={requestedIds} dataLinks={dataLinks} dtDisplay={dtDisplay} callouts={callouts} filter={filter}
              pickedId={picked?.id} onHover={setHover} onPick={setPicked} />

            {/* caption */}
            {started && sec < 45 && (
              <div className="pointer-events-none relative m-2 md:absolute md:m-0 md:left-[50.5%] md:top-[13%] md:w-[min(40%,320px)] md:-translate-x-1/2">
              <div key={phase.title} className="fadein rounded-md border px-3 py-2 text-center shadow-glow"
                style={{ background: tone.bg, borderColor: tone.ring }}>
                <div className="text-[10.5px] font-bold uppercase tracking-[0.16em]" style={{ color: tone.c }}>{phase.kicker}</div>
                <div className="font-display text-base font-extrabold uppercase leading-tight sm:text-lg" style={{ color: tone.c }}>{phase.title}</div>
                {phase.sub && <div className="text-xs leading-snug text-fgb">{phase.sub}</div>}
              </div></div>
            )}
            {!started && (
              <div className="relative m-2 md:absolute md:m-0 md:left-[50.5%] md:top-[13%] md:w-[min(60%,380px)] md:-translate-x-1/2 rounded-md border border-line bg-white/95 px-4 py-3 text-center shadow-glow">
                <div className="text-sm font-semibold text-fg">One day on a feeder, in 60 seconds</div>
                <div className="text-xs text-dim">First the problem (0–20 s), then FeederFleet (20–60 s). Click any house to inspect it.</div>
                <button onClick={demo.start} className="mt-2 rounded-md bg-grid px-4 py-1.5 text-sm font-bold text-white">▶ Start demo</button>
              </div>
            )}

            {/* midday ladder */}
            {on(5, 20) && <LadderCard sim={sim} stepIdx={stepIdx} />}

            {/* matching card */}
            {on(20, 45) && <MatchCard sec={sec} ev={ev} rowById={rowById} eligible={eligible} fpkPct={fpkPct} fpkHr={fpkHr} wo={wo} wi={wi} sim={sim} />}

            {/* result */}
            {on(45, DEMO_LEN + 1) && (
              <div className="relative m-2 md:absolute md:m-0 md:left-1/2 md:top-[13%] md:w-[min(94%,780px)] md:-translate-x-1/2"><div className="fadein rounded-lg border border-grid/30 bg-white p-4 shadow-glow">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-grid">Result · one evening</span>
                  <span className="text-[10.5px] font-semibold text-[#7a520c]">{SIM_DISCLAIMER} · {sim.scenario.name}</span>
                  <SimBadge className="ml-auto" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Res k="Evening peak" a={`${A.peakKw.toFixed(0)} kW`} b={`${B.peakKw.toFixed(0)} kW`} d={`↓ ${(100 * (1 - B.peakKw / A.peakKw)).toFixed(1)}%`} />
                  <Res k="Reverse-flow peak" a={`−${Math.abs(A.reverseKw).toFixed(0)}`} b={`−${Math.abs(B.reverseKw).toFixed(0)} kW`} d={`↓ ${(100 * (1 - B.reverseKw / A.reverseKw)).toFixed(1)}%`} />
                  <Res k={`Worst DT (DT-${A.worstDt + 1})`} a={`${A.maxDtPct.toFixed(0)}%`} b={`${B.maxDtPct.toFixed(0)}%`} d={B.maxDtPct <= 100.5 ? 'back under rating' : 'still above rating — shortfall flagged'} />
                </div>
                {sec >= 52 && s137 && (
                  <div className="fadein mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2.5 text-sm">
                    <span className="font-semibold text-grid">✓ Verified</span>
                    <span className="text-fgb">Home #{s137.homeId} delivered <b className="font-mono">{s137.deliveredKwh.toFixed(2)} kWh</b> above its <Term k="BASELINE">baseline</Term> →</span>
                    <span className="font-mono font-bold text-fg">₹{payFor(s137.deliveredKwh).toFixed(2)}</span>
                    <span className="text-xs text-dim">VPP flexibility payment at ₹{RATE_PER_KWH}/kWh (illustrative pilot rate). Solar export credit is separate.</span>
                  </div>
                )}
              </div></div>
            )}

            {/* inspector */}
            {card && <Inspector sim={sim} card={card} pinned={!!picked} step={step} stepIdx={stepIdx} hour={hour}
              onClose={() => setPicked(null)} onOpenHome={onOpenHome} />}
          </div>

          <Timebar demo={demo} />
          <Legend />
        </div>

        {/* try-it + timeline */}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <TryReserve sim={sim} setReserve={setReserve} resetReserves={resetReserves} overrides={overrides} />
          <Timeline sim={sim} sec={started ? sec : -1} ev={ev} eligible={eligible} fpkPct={fpkPct} fpkHr={fpkHr} />
        </div>

        {/* how the VPP works: sensors → algorithm → actions */}
        <VppInterface sim={sim} />
      </div>
    </div>
  )
}

const Res = ({ k, a, b, d }) => (
  <div>
    <div className="text-[11px] font-semibold uppercase tracking-wider text-dim">{k}</div>
    <div className="font-mono"><span className="text-sm text-dim line-through">{a}</span> <span className="text-dim">→</span> <span className="text-xl font-bold text-grid sm:text-2xl">{b}</span></div>
    <div className="text-xs font-semibold text-grid">{d}</div>
  </div>
)

function MatchCard({ sec, ev, rowById, eligible, fpkPct, fpkHr, wo, wi, sim }) {
  const rules = [`Same DT (DT-${ev.dt + 1})`, 'Online (heartbeat)', 'Above owner reserve', 'Inverter can discharge', 'Enough energy for the event']
  const rulesShown = Math.min(rules.length, Math.floor((sec - 20.4) / 0.7) + 1)
  const monitor = ev.match.rows.filter(r => r.verdict === 'monitor').length
  const dispatching = sec >= 32
  const delivering = ev.series?.[stepOf(hourAt(sec))] ?? 0
  return (
    <div className="fadein relative m-2 md:absolute md:m-0 md:left-[1.2%] md:top-[13%] md:w-[min(40%,320px)] rounded-lg border border-line bg-white p-3.5 text-sm shadow-glow">
      <div className="flex items-center gap-2">
        <span className="rounded bg-[#fbe9e5] px-1.5 py-0.5 font-mono text-[11px] font-bold text-alert">DT-{ev.dt + 1}</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-dim">{dispatching ? 'Event active' : 'Dispatch request'}</span>
      </div>
      <div className="mt-1 font-mono text-[15px] font-bold text-fg">Needs {ev.requiredKw} kW · {fmtHr(ev.startStep / 4)}–{fmtHr(ev.endStep / 4)}</div>
      <div className="text-[11px] text-dim">forecast {fpkPct}% of kVA rating at {fpkHr} → target {Math.round(EVENT_TARGET * 100)}% · {ev.hours * 60} min</div>

      {!dispatching && (
        <>
          <ul className="mt-2 grid gap-0.5 text-xs">
            {rules.map((r, k) => (
              <li key={r} className={`flex items-center gap-1.5 transition-opacity ${k < rulesShown ? 'opacity-100' : 'opacity-25'}`}>
                <span className="text-grid">{k < rulesShown ? '✔' : '○'}</span>{r}
              </li>
            ))}
          </ul>
          {sec >= 24.4 && (
            <div className="mt-2 grid gap-1 border-t border-line pt-2">
              {STORY_ORDER.map((id, k) => {
                if (sec < REVEAL0 + k * REVEAL_DT) return null
                const r = rowById[id]
                const ok = r.verdict === 'ok'
                if (r.verdict === 'standby') return (
                  <div key={id} className="fadein flex items-center gap-2 text-xs">
                    <span className="w-[74px] font-mono font-semibold text-fg">Home {id}</span>
                    <span className="font-semibold text-grid">○ Standby {r.offerKw.toFixed(1)} kW</span><span className="text-[10.5px] text-dim">eligible, not needed</span>
                  </div>
                )
                return (
                  <div key={id} className="fadein flex items-center gap-2 text-xs">
                    <span className="w-[74px] font-mono font-semibold text-fg">Home {id}</span>
                    {ok ? <span className="font-semibold text-grid">✅ {r.allocKw.toFixed(1)} kW</span>
                      : <span className={r.verdict === 'offline' ? 'font-semibold text-alert' : 'font-semibold text-dim'}>❌ {r.verdict === 'reserve' ? 'Reserve protected' : r.verdict === 'offline' ? 'Offline' : r.reason}</span>}
                    {id === SPECIAL.FULL && ok && <span className="text-[10.5px] text-dim">full at noon → ready now</span>}
                  </div>
                )
              })}
              {sec >= REVEAL0 + STORY_ORDER.length * REVEAL_DT && (
                <div className="fadein text-[11px] text-dim">+ {monitor} monitor-only batteries under DT-{ev.dt + 1} (<Term k="MONITOR">not controllable</Term>)</div>
              )}
            </div>
          )}
          {sec >= 30.4 && (
            <div className="fadein mt-2 rounded-md bg-[#e6f2ea] px-2.5 py-1.5">
              <div className="text-xs font-bold text-grid">Eligible flexibility found</div>
              <div className="font-mono text-sm font-bold text-fg">Matched {ev.match.matchedKw.toFixed(1)} kW <span className="font-normal text-dim">from {eligible.length} homes</span></div>
              <div className="text-[10.5px] text-dim">{ev.requiredKw} kW + 10% margin · local merit order (biggest safe offer first)</div>
              {ev.match.shortfallKw > 0.05 && <div className="mt-1 text-[10.5px] font-semibold text-[#7a520c]">Short by {ev.match.shortfallKw.toFixed(1)} kW — not enough energy above owner reserves. Reserves are never broken to close the gap.</div>}
            </div>
          )}
        </>
      )}
      {dispatching && <EventMini sim={sim} ev={ev} sec={sec} wo={wo} wi={wi} delivering={delivering} />}
    </div>
  )
}

function EventMini({ sim, ev, sec, wo, wi, delivering }) {
  // DT-10 loading 19:00–23:30, without (dashed red) vs with (green), drawn to scale
  const t0 = 76, t1 = 94, w = 290, h = 96, y0 = 30
  const y1 = Math.max(110, Math.ceil(dtLoadPct(ev.peakWithoutKw, ev.dt) / 5) * 5 + 5)
  const x = t => ((t - t0) / (t1 - t0)) * w
  const y = p => h - ((p - y0) / (y1 - y0)) * h
  const line = scen => sim[scen].steps.slice(t0, t1 + 1).map((s, k) => `${k ? 'L' : 'M'}${x(t0 + k).toFixed(1)},${y(dtLoadPct(s.dtNet[ev.dt], ev.dt)).toFixed(1)}`).join(' ')
  const nowT = Math.min(t1, stepOf(hourAt(sec)))
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-fg">DT-{ev.dt + 1} loading (% of kVA)</span>
        <span className="font-mono text-grid">{sec >= 35 ? `batteries → ${delivering.toFixed(1)} kW` : 'holding charge'}</span>
      </div>
      <svg viewBox={`-26 -6 ${w + 34} ${h + 24}`} className="w-full">
        <rect x={0} y={y(y1)} width={w} height={y(100) - y(y1)} fill="#fbe9e5" />
        <line x1={0} x2={w} y1={y(100)} y2={y(100)} stroke="#c0452f" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={0} x2={w} y1={y(90)} y2={y(90)} stroke="#9fcbad" strokeWidth="1" />
        <text x={-4} y={y(100) + 3} fontSize="9" textAnchor="end" fill="#c0452f">100%</text>
        <text x={-4} y={y(90) + 8} fontSize="9" textAnchor="end" fill="#6b7a70">90%</text>
        <text x={-4} y={y(50) + 3} fontSize="9" textAnchor="end" fill="#6b7a70">50%</text>
        {[19, 21, 23].map(hh => <text key={hh} x={x(hh * 4)} y={h + 13} fontSize="9" textAnchor="middle" fill="#6b7a70">{hh}:00</text>)}
        <path d={line('without')} fill="none" stroke="#b3541e" strokeWidth="1.8" strokeDasharray="4 3" />
        <path d={line('withVpp')} fill="none" stroke="#2f8f6b" strokeWidth="2.4" clipPath="url(#nowclip)" />
        <clipPath id="nowclip"><rect x={0} y={-10} width={x(nowT) + 1} height={h + 20} /></clipPath>
        <line x1={x(nowT)} x2={x(nowT)} y1={0} y2={h} stroke="#163a28" strokeWidth="1" />
      </svg>
      <div className="flex gap-3 text-[10.5px] text-dim">
        <span><span className="inline-block h-0.5 w-3 bg-[#b3541e] align-middle" /> without VPP</span>
        <span><span className="inline-block h-0.5 w-3 bg-[#2f8f6b] align-middle" /> with FeederFleet</span>
        <span className="ml-auto font-mono">{wi.toFixed(0)}% now</span>
      </div>
    </div>
  )
}

function Inspector({ sim, card, pinned, step, stepIdx, hour, onClose, onOpenHome }) {
  const left = `${Math.min(84, Math.max(16, (card.x / W) * 100))}%`
  const top = `${((card.y - VB_Y) / VB_H) * 100}%`
  if (card.dt != null) {
    const pct = dtLoadPct(step.dtNet[card.dt], card.dt)
    const wo = dtLoadPct(sim.without.steps[stepIdx].dtNet[card.dt], card.dt)
    const ctrl = sim.homes.filter(h => h.dt === card.dt && h.battery.controllable).length
    return (
      <div className="pointer-events-none absolute z-20 w-56 -translate-x-1/2 -translate-y-[108%] rounded-md border border-line bg-white p-3 text-xs shadow-glow" style={{ left, top }}>
        <div className="font-bold text-fg"><Term k="DT">DT</Term>-{card.dt + 1} · {DT_RATING[card.dt]} kVA</div>
        <div className="text-dim">{DT_HOMES[card.dt]} homes · {ctrl} VPP-controllable</div>
        <Row k="Loading now" v={pct < 0 ? `${Math.abs(pct).toFixed(0)}% export` : `${pct.toFixed(0)}%`} />
        <Row k="Without VPP" v={wo < 0 ? `${Math.abs(wo).toFixed(0)}% export` : `${wo.toFixed(0)}%`} />
      </div>
    )
  }
  const h = sim.homes[card.id - 1]
  const e = homeEnergy(sim, h, stepIdx)
  const st = statusOf(h, step, hour)
  const es = ENERGY_STATE[e.state]
  const b = h.battery
  return (
    <div className={`absolute z-20 w-64 -translate-x-1/2 -translate-y-[104%] rounded-md border border-line bg-white p-3 text-xs shadow-glow ${pinned ? '' : 'pointer-events-none'}`} style={{ left, top }}
      onClick={ev => ev.stopPropagation()}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-bold text-fg">HOME #{h.id}</span>
        <span className="text-dim">DT-{h.dt + 1} · phase {h.phase}</span>
        {pinned && <button onClick={onClose} className="ml-auto text-dim hover:text-fg" aria-label="Close">✕</button>}
      </div>
      <div className="mt-1.5 inline-flex rounded px-1.5 py-0.5 font-semibold" style={{ background: es.bg, color: es.color }}>
        {es.icon} {es.label.toUpperCase()} {e.net >= 0 ? '+' : '−'}{Math.abs(e.net).toFixed(1)} kW
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3">
        <Row k="Solar" v={`${e.pv.toFixed(1)} kW`} />
        <Row k="Consumption" v={`${e.load.toFixed(1)} kW`} />
        <Row k={<Term k="SOC">Battery</Term>} v={`${Math.round(e.soc * 100)}%`} />
        <Row k={<Term k="RESERVE">Reserve</Term>} v={`${Math.round(b.reserve * 100)}%`} />
        <Row k={<Term k="FLEX">VPP available</Term>} v={b.controllable ? `${availOf(h, step).toFixed(1)} kWh` : '—'} />
        <Row k="Battery" v={`${b.cap} kWh ${b.type === 'li' ? 'Li' : 'lead-acid'}`} />
      </div>
      <div className="mt-1.5 relative h-2 rounded bg-panel2">
        <div className="h-2 rounded" style={{ width: `${e.soc * 100}%`, background: STATUS_META[st].color }} />
        <div className="absolute -top-0.5 h-3 w-0.5 bg-fg" style={{ left: `${b.reserve * 100}%` }} title="owner reserve" />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="font-semibold" style={{ color: STATUS_META[st].color === '#c3cec6' ? '#6b7a70' : STATUS_META[st].color }}>● {STATUS_META[st].label.toUpperCase()}</span>
        {pinned && <button onClick={() => onOpenHome(h.id)} className="font-semibold text-grid hover:underline">Home dashboard →</button>}
      </div>
    </div>
  )
}
const Row = ({ k, v }) => (
  <div className="flex justify-between gap-2 border-b border-line/60 py-0.5"><span className="text-dim">{k}</span><span className="font-mono font-semibold text-fg">{v}</span></div>
)

function Timebar({ demo }) {
  const marks = [[0, 'Morning'], [5, 'Midday'], [12, 'Problem'], [20, 'VPP'], [32, 'Dispatch'], [45, 'Result']]
  return (
    <div className="flex items-center gap-3 border-t border-line px-3 py-2.5">
      <button onClick={demo.running ? demo.pause : demo.start} className="w-9 rounded border border-line py-1 text-sm text-fg hover:border-grid/40" aria-label={demo.running ? 'Pause' : 'Play'}>
        {demo.running ? '❚❚' : '▶'}
      </button>
      <span className="w-14 shrink-0 font-mono text-base font-bold text-fg">{fmtHr(demo.hour)}</span>
      <div className="relative flex-1 pb-3.5">
        <input type="range" min={0} max={DEMO_LEN} step={0.1} value={demo.sec} onChange={e => demo.seek(+e.target.value)} className="timebar w-full" aria-label="Demo time" />
        {marks.map(([s, l], k) => (
          <span key={l} className={`absolute top-4 hidden text-[10px] text-dim sm:inline ${k ? '-translate-x-1/2' : ''}`} style={{ left: `${(s / DEMO_LEN) * 100}%` }}>{l}</span>
        ))}
      </div>
      <span className="hidden w-14 text-right font-mono text-xs text-dim sm:inline">{Math.floor(demo.sec)} s</span>
    </div>
  )
}

function Legend() {
  const items = [
    ['#4fa36a', 'Available / charging'], ['#6fae84', 'Powering own home'], ['#1f6b45', 'Supporting feeder (VPP)'], ['#c98a1b', 'Battery full'],
    ['#8c948f', 'Reserve / offline'], ['#c3cec6', 'Monitor-only'],
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-panel2/60 px-3 py-2 text-[11px] text-fgb">
      <span className="font-semibold text-dim">Battery</span>
      {items.map(([c, l]) => <span key={l} className="inline-flex items-center gap-1.5"><span className="h-3 w-2 rounded-sm" style={{ background: c }} />{l}</span>)}
      <span className="font-semibold text-dim">Flow</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#d9962a]" />solar back to substation</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#8aa594]" />grid supply</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#2f8f6b]" />battery support</span>
      <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-[#2f8f6b]" />VPP data (not power)</span>
      <span className="font-semibold text-dim">House</span>
      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#d7a12d]" /><span className="font-mono text-[#8a5d0f]">2.4</span> solar kW · <span className="inline-block h-2 w-2 bg-[#b3541e] [clip-path:polygon(50%_0,100%_45%,100%_100%,0_100%,0_45%)]" /><span className="font-mono text-[#9b3f1a]">1.1</span> home load kW</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-fg" />owner reserve on battery</span>
      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#d7a12d]" />surplus <span className="h-2 w-2 rounded-full bg-[#4fa36a]" />balanced <span className="h-2 w-2 rounded-full bg-[#c0452f]" />deficit</span>
    </div>
  )
}

function FlowRail({ sec }) {
  const cur = sec < 0 ? -1 : flowIdx(sec)
  return (
    <div className="rounded-lg border border-line bg-white p-3.5 shadow-card">
      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-dim">How FeederFleet decides</div>
      <ol className="relative grid gap-0.5">
        {FLOW.map((f, k) => {
          const state = k < cur ? 'done' : k === cur ? 'now' : 'next'
          return (
            <li key={f.k} className={`relative flex gap-2.5 rounded px-2 py-1.5 transition-colors duration-300 ${state === 'now' ? 'bg-[#e6f2ea]' : ''}`}>
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${state === 'now' ? 'bg-grid text-white' : state === 'done' ? 'bg-[#cfe6d6] text-grid' : 'border border-line text-dim'}`}>
                {state === 'done' ? '✓' : k + 1}
              </span>
              <div className="min-w-0">
                <div className={`text-xs font-bold tracking-wide ${state === 'next' ? 'text-dim' : 'text-fg'}`}>{f.k}</div>
                {state === 'now' && <div className="text-[11px] leading-snug text-fgb">{f.d}</div>}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Timeline({ sim, sec, ev, eligible, fpkPct, fpkHr }) {
  const log = sim.withVpp.log
  const rowById = Object.fromEntries(ev.match.rows.map(r => [r.id, r]))
  const tOf = re => { const l = log.find(x => re.test(x.msg)); return l ? l.t * 0.25 : null }
  const absorbHr = tOf(/coordinated charging/)
  const rv = sim.withVpp.steps.reduce((b, s) => (s.feederNet < b.feederNet ? s : b))
  const pk = sim.metrics.withVpp.peakKw
  const delivered = ev.deliveredKwh
  const paid = ev.perHome.reduce((a, p) => a + payFor(p.deliveredKwh), 0)
  const items = [
    [6.0, 'green', `Monitoring ${N_HOMES} homes · ${sim.homes.filter(h => h.battery.controllable).length} VPP-controllable`],
    [11.0, 'amber', `Home #${SPECIAL.FULL}: battery full — cannot absorb more`],
    absorbHr && [absorbHr, 'amber', 'Feeder export above envelope → coordinated charging, then flexible loads'],
    [rv.hr, 'amber', `Reverse-flow peak: ${Math.abs(rv.feederNet).toFixed(0)} kW back to the substation`],
    [17.5, 'red', `Forecast: DT-${ev.dt + 1} at ${fpkPct}% of kVA rating at ${fpkHr} → event created`],
    rowById[SPECIAL.COMMS]?.verdict === 'offline' && [offlineSince(SPECIAL.COMMS), 'grey', `Home #${SPECIAL.COMMS}: no heartbeat → safe local mode, delivery = 0`],
    rowById[SPECIAL.RESERVE]?.verdict === 'reserve' && [19.0, 'grey', `Home #${SPECIAL.RESERVE}: skipped — owner reserve ${Math.round(rowById[SPECIAL.RESERVE].reserve * 100)}%`],
    [19.5, ev.match.shortfallKw > 0.05 ? 'amber' : 'green', `Matched ${ev.match.matchedKw.toFixed(1)} of ${ev.requiredKw} kW from ${eligible.length} homes under DT-${ev.dt + 1}${ev.match.shortfallKw > 0.05 ? ` — short by ${ev.match.shortfallKw.toFixed(1)} kW` : ''}`],
    [ev.activeStart * 0.25, 'green', `Dispatch starts on DT-${ev.dt + 1} (closed loop on the DT meter)`],
    ...ev.replans.map(rp => [rp.t * 0.25, rp.added.length ? 'amber' : 'red', `Home ${rp.droppedIds.map(i => '#' + i).join(', ')} stopped responding → replanned on live state: ${rp.added.length ? rp.added.map(a => `#${a.id} +${a.kw.toFixed(1)} kW`).join(', ') : 'no eligible home left'}`]),
    [21.75, 'green', `DT-${ev.dt + 1} peak ${Math.round(dtLoadPct(ev.peakWithoutKw, ev.dt))}% → ${Math.round(dtLoadPct(ev.peakWithKw, ev.dt))}% of rating · feeder peak ${pk.toFixed(0)} kW (without: ${sim.metrics.without.peakKw.toFixed(0)})`],
    [ev.activeEnd * 0.25, 'grey', 'Event ended · recharge waits for tomorrow’s solar'],
    [23.25, 'green', `Verified: ${delivered.toFixed(1)} kWh delivered above baseline`],
    [23.5, 'green', `Settlement queued: ₹${paid.toFixed(2)} across ${ev.perHome.length} homes`],
  ].filter(Boolean)
  const dot = { green: '#2f8f6b', amber: '#c98a1b', red: '#c0452f', grey: '#9aa59d' }
  const visible = items.filter(([hr]) => sec >= 0 && sec >= secAt(hr))
  return (
    <div className="rounded-lg border border-line bg-white p-3.5 shadow-card">
      <div className="mb-2 flex items-center text-[10.5px] font-semibold uppercase tracking-[0.12em] text-dim">
        Event log <span className="ml-auto font-mono normal-case tracking-normal">{visible.length}/{items.length}</span>
      </div>
      {visible.length === 0 && <p className="text-xs text-dim">Start the demo to stream events.</p>}
      <ul className="grid max-h-[330px] gap-1.5 overflow-y-auto pr-1">
        {[...visible].reverse().map(([hr, t, txt], k) => (
          <li key={txt} className={`flex gap-2 text-[11.5px] leading-snug ${k === 0 ? 'fadein' : ''}`}>
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: dot[t] }} />
            <span className="w-10 shrink-0 font-mono text-dim">{fmtHr(hr)}</span>
            <span className="text-fgb">{txt}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LadderCard({ sim, stepIdx }) {
  // where the midday solar goes (whole feeder, this 15-min step)
  const s = sim.withVpp.steps[stepIdx]
  let battery = 0, flex = 0, curtail = 0
  sim.homes.forEach((h, i) => {
    battery += s.chg[i]
    if (s.flex[i] > 0) flex += s.flex[i]
    curtail += s.curtail[i]
  })
  const solar = s.pvTot
  const exportKw = Math.max(0, -s.feederNet)
  const selfUse = Math.max(0, solar - battery - flex - exportKw)
  const full = sim.homes.filter(h => h.battery.controllable && s.soc[h.id - 1] >= 0.965).length
  const rows = [
    ['☀️ Solar generated', solar, '#c98a1b'],
    ['🏠 Used by homes', selfUse, '#8c948f'],
    ['🔋 Charging batteries', battery, '#2f8f6b'],
    ['♨️ Flexible loads', flex, '#4fa36a'],
    ['↩ Back to the substation', exportKw, '#d9962a'],
    ['✂ Curtailed (last resort)', curtail, '#b9c6bc'],
  ]
  return (
    <div className="fadein relative m-2 md:absolute md:m-0 md:left-[1.2%] md:top-[13%] md:w-[min(40%,290px)] rounded-lg border border-line bg-white p-3 text-xs shadow-glow">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-dim">Where the solar goes · {fmtHr(stepIdx / 4)}</div>
      <div className="mt-1.5 grid gap-1">
        {rows.map(([k, v, c], i) => (
          <div key={k} className={i === 0 ? 'border-b border-line pb-1' : ''}>
            <div className="flex justify-between"><span className="text-fgb">{k}</span><span className="font-mono font-semibold text-fg">{v.toFixed(0)} kW</span></div>
            {i > 0 && <div className="mt-0.5 h-1.5 rounded bg-panel2"><div className="h-1.5 rounded" style={{ width: `${Math.min(100, (100 * v) / Math.max(1, solar))}%`, background: c }} /></div>}
          </div>
        ))}
      </div>
      <div className="mt-1.5 text-[10.5px] leading-snug text-dim">{full} controllable {full === 1 ? 'battery' : 'batteries'} already full. Batteries cannot absorb unlimited solar — the rest still flows back.</div>
    </div>
  )
}

function TryReserve({ sim, setReserve, resetReserves, overrides }) {
  const ev = sim.hero
  const ids = ev.match.rows.filter(r => r.controllable && r.online && r.id !== SPECIAL.RESERVE).map(r => r.id).sort((a, b) => a - b)
  const [id, setId] = useState(SPECIAL.FULL)
  const cur = sim.homes[id - 1].battery.reserve
  const [draft, setDraft] = useState(null)
  const val = draft ?? cur
  const row = ev.match.rows.find(r => r.id === id)
  const mine = ev.perHome.find(p => p.id === id)
  const changed = Object.keys(overrides.reserve).length > 0
  const commit = v => { setDraft(null); setReserve(id, v) }
  return (
    <div className="rounded-lg border border-grid/30 bg-white p-3.5 shadow-card">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-grid">Try it · homeowner reserve</div>
      <p className="mt-0.5 text-[11.5px] leading-snug text-fgb">Raise a homeowner’s backup reserve. The whole day re-runs: the matcher drops the home if it can no longer help safely, and other eligible homes cover what they can.</p>
      <div className="mt-2 flex items-center gap-2">
        <select value={id} onChange={e => { setId(+e.target.value); setDraft(null) }} className="inp py-1 text-xs" aria-label="Home">
          {ids.map(i => <option key={i} value={i}>Home #{i}</option>)}
        </select>
        <span className="font-mono text-sm font-bold text-fg">{Math.round(val * 100)}%</span>
        {changed && <button onClick={() => { setDraft(null); resetReserves() }} className="ml-auto text-[11px] font-semibold text-grid hover:underline">Reset</button>}
      </div>
      <input type="range" min={0.3} max={0.9} step={0.05} value={val} aria-label="Owner reserve"
        onChange={e => setDraft(+e.target.value)} onMouseUp={e => commit(+e.target.value)} onTouchEnd={e => commit(+e.target.value)} onKeyUp={e => commit(+e.target.value)}
        className="timebar mt-1 w-full" />
      <div className="mt-2 grid gap-1 rounded-md bg-panel2/70 p-2 text-[11.5px]">
        <div className="flex justify-between gap-2"><span className="text-dim">Home #{id}</span>
          <span className={`text-right font-semibold ${row.verdict === 'ok' ? 'text-grid' : 'text-dim'}`}>{row.verdict === 'ok' ? `✅ selected · ${row.allocKw.toFixed(1)} kW` : row.verdict === 'standby' ? '○ standby' : `❌ ${row.reason}`}</span></div>
        <div className="flex justify-between gap-2"><span className="text-dim">Requested</span><span className="font-mono">{ev.requiredKw} kW</span></div>
        <div className="flex flex-wrap justify-between gap-x-2"><span className="text-dim">Matched</span><span className="font-mono">{ev.match.matchedKw.toFixed(1)} kW · {ev.match.rows.filter(r => r.allocKw > 0).map(r => '#' + r.id).join(' ')}</span></div>
        <div className="flex justify-between gap-2"><span className="text-dim">Delivered at peak</span><span className="font-mono">{(sim.without.steps[ev.forecastPeakStep].dtNet[ev.dt] - sim.withVpp.steps[ev.forecastPeakStep].dtNet[ev.dt]).toFixed(1)} kW</span></div>
        <div className="flex justify-between gap-2"><span className="text-dim">DT-{ev.dt + 1} peak (% of kVA, pf {PF})</span><span className="font-mono">{dtLoadPct(ev.peakWithoutKw, ev.dt).toFixed(0)}% → {dtLoadPct(ev.peakWithKw, ev.dt).toFixed(0)}% {dtLoadPct(ev.peakWithKw, ev.dt) <= EVENT_TARGET * 100 + 0.5 ? '✓' : ''}</span></div>
        <div className="flex justify-between gap-2"><span className="text-dim">Verified · paid</span><span className="font-mono">{mine ? `${mine.deliveredKwh.toFixed(2)} kWh → ₹${payFor(mine.deliveredKwh).toFixed(2)}` : '₹0 (not dispatched)'}</span></div>
      </div>
    </div>
  )
}

function FlowStrip({ sec }) {
  const cur = sec < 0 ? -1 : flowIdx(sec)
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-card">
      <ol className="flex min-w-[900px] items-stretch">
        {FLOW.map((f, k) => {
          const state = k < cur ? 'done' : k === cur ? 'now' : 'next'
          return (
            <li key={f.k} className={`relative flex flex-1 items-center gap-2 px-3 py-2 transition-colors duration-300 ${state === 'now' ? 'bg-[#e6f2ea]' : ''} ${k ? 'border-l border-line' : ''}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${state === 'now' ? 'bg-grid text-white' : state === 'done' ? 'bg-[#cfe6d6] text-grid' : 'border border-line text-dim'}`}>{state === 'done' ? '✓' : k + 1}</span>
              <div className="min-w-0">
                <div className={`whitespace-nowrap text-[11px] font-bold tracking-wide ${state === 'next' ? 'text-dim' : 'text-fg'}`}>{f.k}</div>
                {state === 'now' && <div className="truncate text-[10.5px] text-fgb">{f.d}</div>}
              </div>
              {state === 'now' && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-grid" />}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
