// VPP interface diagram: sensors (inputs) → algorithm (formulas) → actions (outputs).
// Every constant is read from src/config/scenario.js and the live example from the simulation, so this
// diagram always matches what the engine actually does.
import { CONTROL, GRID, BATTERY, DT_H } from '../config/scenario.js'
import { PF, MATCH_HR, dtLoadPct } from '../sim/engine.js'
import { fmtHr } from '../sim/model.js'
import { RATE_PER_KWH, payFor } from '../data/econ.js'
import { SimBadge, Tag } from './ui.jsx'
import Term from './Term.jsx'

const pct = f => `${Math.round(f * 100)} %`
const T = Math.round(CONTROL.eventTarget * 100) // 90

const INPUTS = [
  { icon: '🔌', k: 'Hybrid inverter / HEMS', via: 'Modbus RS-485 → gateway → 4G', data: ['P_pv — solar (kW)', 'P_load — home use (kW)', 'P_bat — battery (kW, + charge / − discharge)', 'SoC — state of charge (%)', 'heartbeat — online or not'] },
  { icon: '🏭', k: 'DT-FD + CT sensor / RDSS DT meter', via: '4G', data: ['P_DT — transformer power (kW)', 'flow direction (forward / reverse)'] },
  { icon: '📟', k: 'Smart meter', via: '15-min blocks', data: ['import / export (kWh) — cross-check for verification only'] },
  { icon: '📱', k: 'Owner app', via: 'consent', data: ['reserve (%) — never used by the VPP', 'consent / opt-out', 'flexible-load enrolment'] },
  { icon: '☀️', k: 'Forecast inputs', via: 'model', data: ['solar yield (kWh/kWp/day, PVGIS)', 'load history → DT forecast'] },
]

const STEPS = [
  { g: 'Every 15 min', n: 1, k: 'Update battery state', f: [`E(t+Δt) = E(t) + P_chg·Δt·η − P_dis·Δt/η`, `SoC = E / C      Δt = ${DT_H} h`], note: 'η = battery efficiency, C = capacity (kWh)' },
  { g: 'Every 15 min', n: 2, k: 'DT loading', f: [`Load % = P_DT ÷ (S_rated × pf) × 100`, `pf = ${PF} (assumed)`], note: 'S_rated in kVA; negative % = reverse flow' },
  { g: 'Evening event', n: 3, k: 'Forecast & detect stress', f: [`event if forecast peak > ${Math.round(CONTROL.eventTrip * 100)} %`, `P_req = max_t [ P_DT,fc(t) − ${CONTROL.eventTarget}·S·pf ]`], note: `forecast error ±${CONTROL.forecastErrorPct} %; sized with enrolled batteries holding their charge` },
  { g: 'Evening event', n: 4, k: 'Eligibility (per home)', f: [`same DT ∧ controllable ∧ online ∧ consent`, `E_use = C·(SoC − max(floor, reserve))·η`, `P_offer = min(P_inv,max , E_use ÷ T_event) ≥ ${CONTROL.minOfferKw} kW`], note: 'reserve is a hard floor — never crossed' },
  { g: 'Evening event', n: 5, k: 'Match — local merit order', f: [`sort P_offer high → low`, `select until Σ P_offer ≥ (1 + ${CONTROL.matchMargin})·P_req`, `rest = standby · shortfall = P_req − Σ`], note: 'shortfall is reported, never hidden' },
  { g: 'Evening event', n: 6, k: 'Dispatch — closed loop on the DT meter', f: [`need(t) = min(P_DT − ${T} % limit , need(t−1) + ${CONTROL.rampKwPerStep} kW)`, `P_i = need · P_commit,i ÷ Σ P_commit`, `P_i ≤ min(P_inv − P_dis , E_avail ÷ Δt , home load)`], note: `ramp limit avoids a step change; "≤ home load" = no export, so no double payment with net metering; first step loses ${CONTROL.responseDelayMin} min to response delay` },
  { g: 'Evening event', n: 7, k: 'Detect dropout → replan', f: [`no heartbeat → lost = Σ P_commit(dropped)`, `re-run steps 4–5 on CURRENT SoC for T_left`], note: 'standby / spare homes are called; if none, the shortfall is flagged' },
  { g: 'Midday surplus', n: 8, k: 'Surplus ladder (enrolled homes only)', f: [`feeder export > ${GRID.feederExportCapKw} kW → paced charging`, `> ${GRID.feederFlexTripKw} kW → flex load ${CONTROL.flexKw} kW (≤ ${CONTROL.flexMaxH} h/day)`, `> ${GRID.feederExportHardKw} kW → export limit (last resort)`], note: `charging stops at SoC ${pct(BATTERY.socMax)} (BMS limit)` },
  { g: 'After the event', n: 9, k: 'Verify', f: [`Delivered_i = max(0, Σ_online (P_act − P_base)·Δt)`], note: 'P_base = what the battery would have done anyway; offline steps count as zero' },
  { g: 'After the event', n: 10, k: 'Settle', f: [`Pay_i = round(Delivered_i , 2) × ₹${RATE_PER_KWH}/kWh`], note: 'illustrative pilot rate; solar export credit (net metering) stays separate' },
]

const OUTPUTS = [
  { icon: '⚡', k: 'Discharge setpoint (kW)', to: 'gateway → inverter', when: 'evening DT event' },
  { icon: '🔋', k: 'Charge setpoint (kW)', to: 'gateway → inverter', when: 'midday surplus' },
  { icon: '⏸', k: 'Hold charge', to: 'gateway', when: 'from matching until the event' },
  { icon: '♨️', k: 'Flexible load ON', to: 'gateway → water heater / pump', when: 'battery fleet nearly full' },
  { icon: '✂', k: 'Export limit', to: 'inverter', when: 'last resort, enrolled inverters only' },
  { icon: '🛟', k: 'Safe fallback', to: 'gateway (local, no cloud needed)', when: 'heartbeat lost → normal self-use' },
  { icon: '📊', k: 'DT alerts · shortfall · replan log', to: 'DISCOM dashboard', when: 'every 15 min' },
  { icon: '₹', k: 'Statement + payment', to: 'homeowner (bank / UPI)', when: 'after verification' },
]

const GROUP_TONE = {
  'Every 15 min': 'border-line bg-panel2/50',
  'Evening event': 'border-grid/30 bg-[#eef6f0]',
  'Midday surplus': 'border-solar/40 bg-[#fdf6e6]',
  'After the event': 'border-[#c9d6e0] bg-[#eef3f8]',
}

const Arrow = ({ label }) => (
  <div className="flex items-center justify-center py-1 text-dim lg:flex-col lg:py-0" aria-hidden="true">
    <span className="text-2xl leading-none lg:hidden">↓</span>
    <span className="hidden text-2xl leading-none lg:inline">→</span>
    <span className="ml-2 font-mono text-[10px] uppercase tracking-wider lg:ml-0 lg:mt-1 lg:[writing-mode:vertical-rl]">{label}</span>
  </div>
)

export default function VppInterface({ sim }) {
  const ev = sim.hero
  const groups = [...new Set(STEPS.map(s => s.g))]
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-card" aria-labelledby="vpp-if-title">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-dim">How the VPP works · interface diagram</div>
          <h2 id="vpp-if-title" className="text-lg font-extrabold">Sensors → algorithm → actions</h2>
          <p className="text-xs text-dim">The same rules and formulas the simulation above runs, every 15 minutes (Δt = {DT_H} h). kW = power (a rate); kWh = energy (an amount).</p>
        </div>
        <span className="ml-auto"><SimBadge /></span>
      </div>

      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_28px_minmax(0,1.9fr)_28px_minmax(0,1fr)]">
        {/* INPUTS */}
        <div className="grid content-start gap-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg">① Data in · sensors</div>
          {INPUTS.map(c => (
            <div key={c.k} className="rounded-md border border-line p-2.5">
              <div className="flex items-center gap-1.5 text-[13px] font-bold text-fg"><span aria-hidden="true">{c.icon}</span>{c.k}</div>
              <div className="font-mono text-[10.5px] text-grid">{c.via}</div>
              <ul className="mt-1 grid gap-0.5 text-[11.5px] leading-snug text-fgb">{c.data.map(d => <li key={d}>• {d}</li>)}</ul>
            </div>
          ))}
        </div>

        <Arrow label="4G · Modbus" />

        {/* CORE */}
        <div className="grid content-start gap-2 rounded-lg border-2 border-grid/40 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg">② FeederFleet VPP cloud · algorithm</span>
            <span className="ml-auto text-[10.5px] text-dim">forecast · match · dispatch · replan · verify · settle</span>
          </div>
          {groups.map(g => (
            <div key={g} className={`rounded-md border p-2 ${GROUP_TONE[g]}`}>
              <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-dim">{g}</div>
              <div className="grid gap-2 xl:grid-cols-2">
                {STEPS.filter(s => s.g === g).map(s => (
                  <div key={s.n} className="rounded border border-line/70 bg-white p-2">
                    <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-fg">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-grid text-[10px] text-white">{s.n}</span>{s.k}
                    </div>
                    <div className="mt-1 grid gap-0.5 rounded bg-panel2/70 px-2 py-1 font-mono text-[11px] leading-snug text-fg">
                      {s.f.map(x => <div key={x}>{x}</div>)}
                    </div>
                    <div className="mt-1 text-[10.5px] leading-snug text-dim">{s.note}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Arrow label="setpoints · reports" />

        {/* OUTPUTS */}
        <div className="grid content-start gap-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg">③ Actions out</div>
          {OUTPUTS.map(o => (
            <div key={o.k} className="rounded-md border border-line p-2.5">
              <div className="flex items-center gap-1.5 text-[13px] font-bold text-fg"><span aria-hidden="true" className="w-4 text-center">{o.icon}</span>{o.k}</div>
              <div className="font-mono text-[10.5px] text-grid">→ {o.to}</div>
              <div className="text-[11px] text-dim">{o.when}</div>
            </div>
          ))}
        </div>
      </div>

      {ev && <WorkedExample sim={sim} ev={ev} />}

      <p className="mt-3 text-[11px] text-dim">
        <Tag t="SYNTHETIC">Demo</Tag> In this demo the “sensor” values come from the simulation, not from real devices. The <Term k="RESERVE">reserve</Term> and
        the no-export cap are hard limits in the code. Power never goes through the VPP — it only reads data and sends setpoints.
      </p>
    </section>
  )
}

/** The formulas with tonight's simulated numbers for DT-10 and home #137 (or the first dispatched home). */
function WorkedExample({ sim, ev }) {
  const S = sim.dtRating[ev.dt], lim = sim.dtKwLimit[ev.dt]
  const p = ev.perHome.find(x => x.id === 137) || ev.perHome[0]
  const r = p && ev.match.rows.find(x => x.id === p.id)
  const rp = ev.replans[0]
  const lines = [
    ['2', `DT-${ev.dt + 1}: ${S} kVA × ${PF} = ${lim.toFixed(0)} kW = 100 %`],
    ['3', `forecast peak ${ev.forecastPeakKw.toFixed(1)} kW → ${dtLoadPct(ev.forecastPeakKw, ev.dt).toFixed(0)} % > 100 % → event (forecast error today ${ev.forecastBiasPct >= 0 ? '+' : '−'}${Math.abs(ev.forecastBiasPct).toFixed(1)} %) · P_req = ${ev.requiredKw} kW for ${ev.hours} h (${fmtHr(ev.startStep * DT_H)}–${fmtHr(ev.endStep * DT_H)})`],
    r && ['4', `home #${r.id} at ${fmtHr(MATCH_HR)}: E_use = ${r.cap}·(${r.soc.toFixed(3)} − ${Math.max(r.floor, r.reserve).toFixed(2)})·${r.eff} = ${r.usableKwh.toFixed(2)} kWh → P_offer = min(${r.maxDis}, ${r.usableKwh.toFixed(2)} ÷ ${ev.hours}) = ${r.offerKw.toFixed(2)} kW`],
    ['5', `matched Σ = ${ev.match.matchedKw.toFixed(1)} kW from ${ev.match.rows.filter(x => x.allocKw > 0).length} homes · target ${(ev.requiredKw * (1 + CONTROL.matchMargin)).toFixed(1)} kW · shortfall ${ev.match.shortfallKw.toFixed(1)} kW`],
    ['6', `dispatch ${fmtHr(ev.activeStart * DT_H)}–${fmtHr(ev.activeEnd * DT_H)} · DT-${ev.dt + 1} actual peak ${dtLoadPct(ev.peakWithoutKw, ev.dt).toFixed(0)} % → ${dtLoadPct(ev.peakWithKw, ev.dt).toFixed(0)} % (target ${T} %)`],
    rp && ['7', `${fmtHr(rp.t * DT_H)}: home ${rp.droppedIds.map(i => '#' + i).join(', ')} lost (−${rp.lostKw.toFixed(1)} kW) → re-match for ${Math.round(rp.hoursLeft * 60)} min → ${rp.added.length ? rp.added.map(a => `#${a.id} +${a.kw.toFixed(1)} kW`).join(', ') : 'no eligible home left'}`],
    p && ['9', `home #${p.id}: ${p.actualKwh.toFixed(3)} − ${p.baselineKwh.toFixed(3)} = ${p.deliveredKwh.toFixed(3)} kWh → ${p.deliveredKwh.toFixed(2)} kWh verified`],
    p && ['10', `${p.deliveredKwh.toFixed(2)} kWh × ₹${RATE_PER_KWH} = ₹${payFor(p.deliveredKwh).toFixed(2)}`],
  ].filter(Boolean)
  return (
    <div className="mt-3 rounded-md border border-line bg-panel2/40 p-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg">Worked example · tonight’s simulated event</span>
        <span className="text-[10.5px] text-dim">{sim.scenario.name} · numbers from the run above</span>
      </div>
      <ol className="grid gap-1 font-mono text-[11.5px] leading-snug text-fgb">
        {lines.map(([n, t]) => (
          <li key={n + t} className="flex gap-2"><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-grid/80 text-[9px] text-white">{n}</span><span>{t}</span></li>
        ))}
      </ol>
    </div>
  )
}
