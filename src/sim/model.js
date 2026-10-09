// Read-side helpers over the simulation (WITH-VPP scenario unless noted).
import { SPECIAL, homePv, homeLoad, evaluateCandidates, dtLoadPct, isOfflineAt, DT_H } from './engine.js'
import { FAILURES } from '../config/scenario.js'

export const stepOf = hr => Math.min(95, Math.max(0, Math.floor(hr * 4 + 1e-6)))
export const fmtHr = hr => `${String(Math.floor(hr) % 24).padStart(2, '0')}:${String(Math.round((hr % 1) * 60) % 60).padStart(2, '0')}`

/** Per-home energy balance at one step. NOTE: here net > 0 = EXPORTING (opposite of the engine's dtNet/feederNet sign). */
export function homeEnergy(sim, h, stepIdx, scen = 'withVpp') {
  const s = sim[scen].steps[stepIdx]
  const i = h.id - 1
  const pv = Math.max(0, homePv(h, s.hr) - s.curtail[i])
  const load = Math.max(0, homeLoad(h, s.hr) + s.flex[i])
  const chg = s.chg[i], dis = s.dis[i]
  const net = pv - load - chg + dis
  return { pv, load, chg, dis, net, soc: s.soc[i], state: net > 0.1 ? 'surplus' : net < -0.1 ? 'deficit' : 'balanced' }
}

export const ENERGY_STATE = {
  surplus: { icon: '☀️', label: 'Surplus', color: '#7a520c', bg: '#fbf1dc' },
  balanced: { icon: '⚖️', label: 'Balanced', color: '#1f6b45', bg: '#e6f2ea' },
  deficit: { icon: '🔴', label: 'Deficit', color: '#8e2f1f', bg: '#fbeae6' },
}

/** 24-hour series for one home. */
export function homeSeries(sim, h) {
  return sim.withVpp.steps.map((s, t) => {
    const e = homeEnergy(sim, h, t)
    return { h: s.hr, solar: +e.pv.toFixed(2), load: +e.load.toFixed(2), battery: +(e.chg - e.dis).toFixed(2), soc: Math.round(s.soc[h.id - 1] * 100) }
  })
}

export const isOffline = (h, hr) => isOfflineAt(h.id, hr)

/** Device status at one step (drives the battery colour on the map). */
export function statusOf(h, step, hr) {
  const i = h.id - 1
  if (isOffline(h, hr)) return 'offline'
  if (!h.battery.controllable) return 'monitor'
  if (step.curtail[i] > 0.02) return 'curtailed'
  if (step.dis[i] > 0.05) return step.vpp?.[i] ? 'discharging' : 'selfuse'
  if (step.chg[i] > 0.05) return 'charging'
  if (h.id === SPECIAL.RESERVE && hr >= FAILURES.offline[0].fromHr) return 'reserve'
  if (step.soc[i] >= 0.965) return 'full'
  return 'available'
}

export const STATUS_META = {
  available:   { color: '#4fa36a', label: 'Available' },
  charging:    { color: '#4fa36a', label: 'Charging' },
  discharging: { color: '#1f6b45', label: 'Supporting feeder (VPP)' },
  selfuse:     { color: '#6fae84', label: 'Powering own home' },
  reserve:     { color: '#8c948f', label: 'Reserve protected' },
  offline:     { color: '#a9b0ac', label: 'Offline — safe mode' },
  full:        { color: '#c98a1b', label: 'Battery full' },
  curtailed:   { color: '#c98a1b', label: 'Full — export limited' },
  monitor:     { color: '#c3cec6', label: 'Monitor-only' },
}

/** Energy the VPP could use right now (kWh above max(BMS floor, owner reserve), after losses). */
export function availOf(h, step) {
  const b = h.battery
  if (!b.controllable) return 0
  return Math.max(0, (step.soc[h.id - 1] - Math.max(b.floor, b.reserve)) * b.cap * b.eff)
}

/** Candidates for the matching rules on one DT, using battery state at the START of a step. */
export function candidatesAt(sim, dt, stepIdx) {
  const prev = sim.withVpp.steps[Math.max(0, stepIdx - 1)]
  const hr = stepIdx * DT_H
  return sim.homes.filter(h => h.dt === dt).map(h => ({
    id: h.id, dt, controllable: h.battery.controllable, online: !isOffline(h, hr),
    soc: stepIdx === 0 ? h.battery.soc0 : prev.soc[h.id - 1], reserve: h.battery.reserve, floor: h.battery.floor,
    cap: h.battery.cap, eff: h.battery.eff, maxDis: h.battery.maxDis, maxChg: h.battery.maxChg, type: h.battery.type,
  }))
}

export function runMatch(sim, { dt, kind, requiredKw, hours, stepIdx }) {
  const res = evaluateCandidates(candidatesAt(sim, dt, stepIdx), { kind, requiredKw, hours })
  const order = { ok: 0, standby: 1, reserve: 2, full: 2, low: 3, offline: 4, monitor: 5 }
  res.rows.sort((a, b) => order[a.verdict] - order[b.verdict] || b.offerKw - a.offerKw || a.id - b.id)
  return res
}

/** DT colour state from loading % of the kVA rating. Above 100 % = red, above 90 % or exporting > 40 % = amber. */
export function dtTone(pct) {
  if (pct > 100) return 'red'
  if (pct > 90.5 || pct < -40) return 'amber'
  return 'green'
}
export const TONE = {
  green: { c: '#1f6b45', bg: '#e6f2ea', label: 'Normal' },
  amber: { c: '#b37511', bg: '#fbf1dc', label: 'Watch' },
  red: { c: '#c0452f', bg: '#fbe9e5', label: 'Overload' },
}
export const dtPct = (sim, dt, stepIdx, scen = 'withVpp') => dtLoadPct(sim[scen].steps[stepIdx].dtNet[dt], dt)

/** Threshold alerts at one step. */
export const DEFAULT_THRESHOLDS = { exportKw: 2, exportMin: 30, dtPct: 90, reversePct: 40, reserveMargin: 0, heartbeat: 2 }
export function alertsAt(sim, stepIdx, th) {
  const s = sim.withVpp.steps[stepIdx]
  const out = []
  const need = Math.max(1, Math.round(th.exportMin / 15))
  let exporters = 0
  sim.homes.forEach(h => {
    let run = 0
    for (let k = stepIdx; k >= 0 && k > stepIdx - need; k--) {
      if (homeEnergy(sim, h, k).net > th.exportKw) run++
      else break
    }
    if (run >= need) exporters++
  })
  if (exporters) out.push({ kind: 'Home export', level: 'amber', text: `${exporters} homes exporting > ${th.exportKw} kW for ${th.exportMin}+ min` })
  s.dtNet.forEach((n, d) => {
    const pct = dtLoadPct(n, d)
    if (pct >= th.dtPct) out.push({ kind: 'DT loading', level: pct > 100 ? 'red' : 'amber', text: `DT-${d + 1} at ${pct.toFixed(0)}% (limit ${th.dtPct}%)` })
    if (-pct >= th.reversePct) out.push({ kind: 'Reverse flow', level: 'amber', text: `DT-${d + 1} exporting ${(-pct).toFixed(0)}% of rating` })
  })
  let atReserve = 0
  sim.homes.forEach(h => {
    const b = h.battery
    if (b.controllable && s.soc[h.id - 1] <= Math.max(b.floor, b.reserve) + th.reserveMargin / 100 + 0.005) atReserve++
  })
  if (atReserve) out.push({ kind: 'Reserve', level: 'grey', text: `${atReserve} batteries at their owner reserve — excluded` })
  FAILURES.offline.forEach(f => {
    if (s.hr >= f.fromHr + th.heartbeat * DT_H - 1e-9) out.push({ kind: 'Comms', level: 'grey', text: `Home #${f.id}: no heartbeat for ${th.heartbeat}+ cycles — safe local mode` })
  })
  return out
}

// ---------- settlement ledger notes (shared by the DISCOM and My Home pages) ----------
export const VERDICT_NOTE = {
  offline: 'no heartbeat — safe local mode, counted as zero',
  standby: 'standby — eligible, not needed tonight',
  reserve: 'reserve protected — not asked to discharge',
  low: 'too little energy above reserve — not asked',
}
/** Ledger note for a dispatched home. */
export function perHomeNote(p, fmt) {
  if (p.droppedOut) return `stopped responding mid-event — ${p.gapSteps * 15} min without telemetry counted as zero`
  if (p.replanStep != null) return `called by the replan at ${fmt(p.replanStep / 4)}`
  if (p.partial) return 'delivered only part of each setpoint (inverter limit) — paid for what was measured'
  return ''
}
