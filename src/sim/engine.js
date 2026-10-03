/**
 * FeederFleet — day simulation engine.
 * SIMULATED / CONCEPTUAL. A hypothetical Gujarat 11 kV feeder:
 *   500 battery-equipped homes (problem-statement upper bound), 12 distribution transformers (DTs).
 *   103 homes have a VPP-controllable lithium battery + hybrid inverter (scenario assumption); 397 are monitor-only.
 * All numbers are demo assumptions (documented in CONCEPT.md), not measurements.
 *
 * Two scenarios over one day in 15-minute steps (96 steps):
 *   WITHOUT — every battery runs plain self-consumption (today's behaviour).
 *   WITH    — FeederFleet coordinates the controllable subset:
 *             midday: paced charging -> flexible loads -> export limit (last resort);
 *             evening: a DT-targeted event on the stressed DT (forecast -> match -> hold -> dispatch)
 *             plus reactive feeder-head peak shaving, always above each owner's reserve.
 */

// ---------- deterministic RNG ----------
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const STEPS = 96
export const DT_H = 0.25

// One row per DT. kVA ratings (kW ~= kVA at pf ~1 for this concept demo).
// solar = homes with rooftop PV, li = VPP-controllable lithium + hybrid inverter,
// li10 = of those, 10 kWh / 5 kW units (rest 5 kWh / 3 kW), ac = evening AC load range (kW).
// Every other home has a monitor-only battery (lead-acid inverter backup or closed-API hybrid).
const DT_CFG = [
  { kva: 100, homes: 40, solar: 18, li: 8, li10: 1, ac: [0.9, 2.0] },
  { kva: 100, homes: 40, solar: 17, li: 8, li10: 1, ac: [0.9, 2.0] },
  { kva: 160, homes: 50, solar: 36, li: 12, li10: 2, ac: [0.9, 2.0] }, // solar-heavy
  { kva: 160, homes: 50, solar: 35, li: 12, li10: 2, ac: [0.9, 2.0] }, // solar-heavy
  { kva: 100, homes: 40, solar: 18, li: 8, li10: 1, ac: [0.9, 2.0] },
  { kva: 100, homes: 40, solar: 17, li: 8, li10: 1, ac: [1.0, 2.1] },
  { kva: 160, homes: 45, solar: 22, li: 9, li10: 1, ac: [1.0, 2.1] },
  { kva: 100, homes: 40, solar: 17, li: 8, li10: 1, ac: [1.0, 2.2] },
  { kva: 100, homes: 35, solar: 15, li: 7, li10: 1, ac: [1.2, 2.4] },
  // DT-10: solar-heavy (midday reverse flow) AND a sharp late-night AC peak (bedroom ACs switch on together)
  { kva: 100, homes: 42, solar: 28, li: 8, li10: 2, ac: [1.7, 2.6], acMu: 21.6, acSig: 1.15 },
  { kva: 100, homes: 38, solar: 18, li: 8, li10: 1, ac: [0.9, 2.0] },
  { kva: 100, homes: 40, solar: 16, li: 7, li10: 1, ac: [0.9, 2.0] },
]
export const N_DT = DT_CFG.length
export const N_HOMES = DT_CFG.reduce((a, d) => a + d.homes, 0) // 500
export const DT_RATING = DT_CFG.map(d => d.kva)
export const DT_HOMES = DT_CFG.map(d => d.homes)

export const SOLAR_DTS = [2, 3, 9]   // midday reverse-flow stress
export const HERO_DT = 9             // DT-10: the story transformer
export const EVENT_DTS = [9]         // DTs that get a targeted evening event

// control thresholds (the "envelopes")
const FEEDER_EXPORT_CAP = 330  // kW export at feeder head before fleet charging kicks in
const FEEDER_FLEX_TRIP = 370   // kW export: engage flexible loads fleet-wide
const FEEDER_EXPORT_HARD = 395 // kW export: last-resort export limiting
const DT_EXPORT_SOFT = 0.40    // charge local batteries above this export fraction
const DT_EXPORT_FLEX = 0.46    // add flexible-load soak above this
const DT_EXPORT_HARD = 0.52    // export-limit (curtail PV) above this
export const EVENT_TRIP = 1.0  // forecast loading that triggers a DT event
export const EVENT_TARGET = 0.9 // loading the event holds the DT to (window = forecast above this)
const KEEP_FRAC = 0.4          // evening: share of capacity held back for the feeder peak
export const MATCH_HR = 19.0
export const RAMP_KW = 10        // event ramp limit (kW per 15-min step) — avoids a step change on the DT   // matching / commitment time (after sunset, SoC is at its evening max)

export const SPECIAL = {
  SETTLED: 137, // settlement example (DT-10, dispatched)
  RESERVE: 141, // owner keeps 85 % for backup -> "reserve protected" (DT-10)
  COMMS: 204,   // comms lost 18:30 -> safe local fallback, delivery = 0 (DT-10)
  FULL: 58,     // battery full at noon -> cannot absorb; best helper in the evening (DT-10)
  HELPERS: [17, 41, 229], // named eligible homes in the demo (DT-10)
  STANDBY: 312, // eligible but not needed at first — joins if another home drops out (DT-10)
}

const gauss = (h, mu, sigma) => Math.exp(-((h - mu) ** 2) / (2 * sigma * sigma))

function solarShape(h) {
  if (h < 6.6 || h > 19.0) return 0
  return Math.max(0, Math.sin(Math.PI * (h - 6.6) / (19.0 - 6.6))) ** 1.3
}

// ---------- fleet ----------
export function buildFleet(seed = 20260927, overrides = {}) {
  const rnd = mulberry32(seed)
  const homes = []
  let id = 1
  DT_CFG.forEach((c, dt) => {
    for (let i = 0; i < c.homes; i++) {
      const hasSolar = i < c.solar
      homes.push({
        id: id++, dt, phase: ['R', 'Y', 'B'][i % 3],
        kwp: hasSolar ? 3.0 + rnd() * 1.6 : 0,
        pvNoise: 0.92 + rnd() * 0.13,
        base: 0.22 + rnd() * 0.1,
        morning: 0.35 + rnd() * 0.3,
        ac: c.ac[0] + rnd() * (c.ac[1] - c.ac[0]),
        acMu: c.acMu ?? 21.2, acSig: c.acSig ?? 2.0,
        battery: null,
      })
    }
  })
  DT_CFG.forEach((c, dt) => {
    const inDt = homes.filter(h => h.dt === dt)
    // controllable lithium first on solar homes, then the rest are monitor-only
    inDt.forEach((h, k) => {
      if (k < c.li) {
        const big = k < c.li10
        h.battery = {
          type: 'li', controllable: true,
          cap: big ? 10.0 : 5.0, floor: 0.10, reserve: 0.30,
          maxChg: big ? 5.0 : 3.0, maxDis: big ? 5.0 : 3.0, eff: 0.95,
          soc0: 0.32 + rnd() * 0.12,
        }
      } else {
        h.battery = {
          type: 'pb', controllable: false,
          cap: 2.4, floor: 0.50, reserve: 0.50,
          maxChg: 0.6, maxDis: 0.5, eff: 0.80,
          soc0: 0.55,
          // non-solar lead-acid = classic inverter UPS: float-charged, used only in outages
          idle: h.kwp === 0,
        }
      }
    })
  })
  // pin story homes to fixed consumer ids by swapping ids (location stays with the home)
  const hero = h => h.dt === HERO_DT && h.battery?.controllable
  const taken = new Set()
  const pin = (wantId, pick) => {
    const target = homes.find(h => pick(h) && !taken.has(h))
    const holder = homes.find(h => h.id === wantId)
    if (target && holder && target !== holder) { holder.id = target.id; target.id = wantId }
    taken.add(target)
  }
  pin(SPECIAL.SETTLED, h => hero(h) && h.battery.cap === 5)
  pin(SPECIAL.RESERVE, h => hero(h) && h.battery.cap === 5)
  pin(SPECIAL.COMMS, h => hero(h) && h.battery.cap === 5)
  pin(SPECIAL.FULL, h => hero(h) && h.battery.cap === 5)
  pin(17, h => hero(h) && h.battery.cap === 10)
  pin(41, h => hero(h) && h.battery.cap === 5)
  pin(229, h => hero(h) && h.battery.cap === 10)
  pin(312, h => hero(h) && h.battery.cap === 5)
  homes.sort((a, b) => a.id - b.id) // after sorting, index === id - 1
  homes[SPECIAL.RESERVE - 1].battery.reserve = 0.85 // cautious owner: high protected reserve
  homes[SPECIAL.FULL - 1].battery.soc0 = 0.93       // started the day nearly full
  for (const [id, r] of Object.entries(overrides.reserve || {})) homes[id - 1].battery.reserve = r // homeowner reserve slider
  return homes
}

export const homeLoad = (h, hr) =>
  h.base
  + h.morning * gauss(hr, 7.6, 1.3)
  + 0.18 * gauss(hr, 13.0, 2.2)
  + h.ac * (gauss(hr, h.acMu, h.acSig) + 0.16 * gauss(hr, 23.2, 1.1))

// 0.684 calibrates a clear day to 4.96 kWh/kWp/day — the best measured month for a rooftop
// system in Anand, Gujarat (Vekariya et al. 2024, verified in research ledger SUR-032).
export const PV_SCALE = 0.684
export const homePv = (h, hr) => h.kwp * PV_SCALE * solarShape(hr) * h.pvNoise
export { solarShape }

/**
 * THE MATCHING RULES (one function, used by the engine and by the DISCOM panel).
 * candidate: { id, dt, controllable, online, soc, reserve, floor, cap, eff, maxDis, maxChg }
 * kind 'support' = discharge to relieve an overload; 'absorb' = charge to soak surplus.
 * Rules, in order: same DT · controllable inverter · online · above reserve / not full ·
 * sufficient energy for the whole event. Offer = min(inverter kW, usable kWh ÷ hours).
 * Allocation: local merit order — biggest offer first (ties: more usable energy, then lower id), whole
 * offers (compared to 0.1 kW; ties → lower id), until the request plus a 10 % margin for non-delivery is covered. The rest stay on STANDBY
 * and are called automatically if a selected home drops out (reserve raised, offline).
 */
export const MATCH_MARGIN = 0.10
export const MIN_OFFER_KW = 0.8
export function evaluateCandidates(cands, { kind, requiredKw, hours }) {
  const rows = cands.map(c => {
    const row = { ...c, offerKw: 0, allocKw: 0, usableKwh: 0 }
    if (!c.controllable) return { ...row, verdict: 'monitor', reason: 'Not controllable (monitor-only)' }
    if (!c.online) return { ...row, verdict: 'offline', reason: 'Offline — no heartbeat' }
    if (kind === 'support') {
      const usable = Math.max(0, (c.soc - Math.max(c.floor, c.reserve)) * c.cap * c.eff)
      row.usableKwh = usable
      if (c.reserve >= 0.5 && usable < MIN_OFFER_KW * hours) return { ...row, verdict: 'reserve', reason: `Reserve protected (owner keeps ${Math.round(c.reserve * 100)}%)` }
      const offer = Math.min(c.maxDis, usable / hours)
      if (offer < MIN_OFFER_KW) return { ...row, verdict: 'low', reason: 'Too little energy above reserve' }
      row.offerKw = offer
    } else {
      const room = Math.max(0, (0.98 - c.soc) * c.cap / c.eff)
      row.usableKwh = room
      const offer = Math.min(c.maxChg, room / hours)
      if (offer < 0.3) return { ...row, verdict: 'full', reason: 'Battery full — cannot absorb' }
      row.offerKw = offer
    }
    return { ...row, verdict: 'ok', reason: 'Eligible' }
  })
  const ok = rows.filter(r => r.verdict === 'ok')
    .sort((a, b) => Math.round(b.offerKw * 10) - Math.round(a.offerKw * 10) || a.id - b.id) // offers compared to 0.1 kW
  const offered = ok.reduce((a, r) => a + r.offerKw, 0)
  const target = requiredKw * (1 + MATCH_MARGIN)
  let got = 0
  ok.forEach((r, k) => {
    r.rank = k + 1
    if (got < target - 0.01) { r.allocKw = r.offerKw; got += r.offerKw } else r.verdict = 'standby'
  })
  const matchedKw = got
  return { rows, offeredKw: offered, targetKw: target, matchedKw, shortfallKw: Math.max(0, requiredKw - matchedKw) }
}

// ---------- scenario run ----------
function run(homes, { vpp, forecast, peakCap = Infinity }) {
  const FEEDER_PEAK_CAP = peakCap
  const N = homes.length
  const E = homes.map(h => h.battery.soc0 * h.battery.cap)
  const floorE = homes.map(h => Math.max(h.battery.floor, h.battery.reserve) * h.battery.cap)
  const capE = homes.map(h => 0.98 * h.battery.cap)
  const availKwh = i => Math.max(0, (E[i] - floorE[i]) * homes[i].battery.eff)
  const roomKw = i => Math.max(0, (capE[i] - E[i]) * 4 / homes[i].battery.eff)

  const steps = [], log = []
  let curtailedKwh = 0, flexKwh = 0, prevGlobalDis = 0
  const alerted = {}
  const note = (t, msg, kind = 'info') => log.push({ t, msg, kind })

  // ---- plan the DT events from the forecast (the WITHOUT run = "business as usual" forecast) ----
  const events = []
  if (vpp) {
    for (const dt of EVENT_DTS) {
      const r = DT_RATING[dt]
      const series = forecast.map(s => s.dtNet[dt])
      let pk = -1
      for (let t = 0; t < STEPS; t++) if (t * DT_H >= 17 && (pk < 0 || series[t] > series[pk])) pk = t
      if (series[pk] <= EVENT_TRIP * r) continue
      let a = pk, b = pk
      while (a > 0 && series[a - 1] > EVENT_TARGET * r) a--
      while (b < STEPS - 1 && series[b + 1] > EVENT_TARGET * r) b++
      const requiredKw = Math.max(...series.slice(a, b + 1).map(n => n - EVENT_TARGET * r))
      events.push({ dt, startStep: a, endStep: b + 1, hours: (b + 1 - a) * DT_H, requiredKw: Math.ceil(requiredKw), forecastPeakKw: series[pk], forecastPeakStep: pk })
    }
  }
  const commit = new Map() // home index -> committed kW for its DT event
  const eventOf = new Map()

  for (let t = 0; t < STEPS; t++) {
    const hr = t * DT_H
    const pv = homes.map(h => homePv(h, hr))
    const load = homes.map(h => homeLoad(h, hr))
    const chg = new Float64Array(N)
    const dis = new Float64Array(N)
    const flexAdd = new Float64Array(N)
    const curtail = new Float64Array(N)
    const vppDis = new Uint8Array(N) // 1 = discharge requested by the VPP (event or feeder peak)

    const commsLost = i => vpp && homes[i].id === SPECIAL.COMMS && hr >= MATCH_HR
    const isManaged = i => vpp && homes[i].battery.controllable && !commsLost(i)

    // ---- matching at MATCH_HR (state = start of this step) ----
    if (vpp && Math.abs(hr - MATCH_HR) < 1e-9) {
      for (const ev of events) {
        const cands = homes.map((h, i) => ({ h, i })).filter(({ h }) => h.dt === ev.dt).map(({ h, i }) => ({
          id: h.id, dt: h.dt, controllable: h.battery.controllable, online: !commsLost(i),
          soc: E[i] / h.battery.cap, reserve: h.battery.reserve, floor: h.battery.floor, cap: h.battery.cap,
          eff: h.battery.eff, maxDis: h.battery.maxDis, maxChg: h.battery.maxChg, type: h.battery.type,
        }))
        const res = evaluateCandidates(cands, { kind: 'support', requiredKw: ev.requiredKw, hours: ev.hours })
        ev.match = { ...res, stepIdx: t }
        res.rows.filter(r => r.allocKw > 0).forEach(r => { commit.set(r.id - 1, r.allocKw); eventOf.set(r.id - 1, ev) })
        note(t, `DT-${ev.dt + 1}: forecast ${Math.round(100 * ev.forecastPeakKw / DT_RATING[ev.dt])}% → request ${ev.requiredKw} kW for ${ev.hours * 60} min · matched ${res.matchedKw.toFixed(1)} kW from ${res.rows.filter(r => r.allocKw > 0).length} homes`, 'alert')
      }
    }

    // -- self-consumption for unmanaged batteries --
    homes.forEach((h, i) => {
      const b = h.battery
      if (isManaged(i) || b.idle) return
      const excess = pv[i] - load[i]
      if (excess > 0) {
        const c = Math.min(excess, b.maxChg, roomKw(i))
        chg[i] = c; E[i] += c * DT_H * b.eff
      } else {
        const d = Math.min(-excess, b.maxDis, availKwh(i) * 4)
        dis[i] = d; E[i] -= d * DT_H / b.eff
      }
    })

    if (vpp) {
      const managed = homes.map((_, i) => i).filter(isManaged)
      const netOf = i => load[i] + flexAdd[i] - pv[i] + chg[i] - dis[i]
      const dtNetNow = dt => homes.reduce((a, h, i) => a + (h.dt === dt ? netOf(i) : 0), 0)
      const feederNow = () => homes.reduce((a, _, i) => a + netOf(i), 0)

      // ===== own-surplus charging (11:00 → sunset); morning headroom kept for the solar peak =====
      if (hr >= 10.5 && hr < MATCH_HR) {
        const ramp = Math.min(1, (hr - 10.25) / 1.25) // eased in 10:30 → 11:30 (no step change on the feeder)
        for (const i of managed) {
          const b = homes[i].battery
          const surplus = pv[i] - load[i]
          if (surplus > 0) { const c = Math.min(surplus * ramp, b.maxChg, roomKw(i)); chg[i] = c; E[i] += c * DT_H * b.eff }
        }
      }
      // ===== before evening: managed homes self-consume normally =====
      if (hr < MATCH_HR) {
        for (const i of managed) {
          const b = homes[i].battery
          const deficit = load[i] - pv[i]
          if (deficit > 0 && chg[i] === 0 && hr >= 16) { const d = Math.min(deficit, b.maxDis, availKwh(i) * 4); dis[i] = d; E[i] -= d * DT_H / b.eff }
        }
      }

      // ===== MIDDAY (10:00–16:00): absorb -> flex -> export-limit =====
      if (hr >= 10.0 && hr < 16.0) {
        let exportKw = Math.max(0, -feederNow())
        if (exportKw > FEEDER_EXPORT_CAP) {
          let need = (exportKw - FEEDER_EXPORT_CAP) * (hr < 12.0 ? 0.5 : 1.0)
          const pool = managed.map(i => ({ i, room: roomKw(i) })).filter(x => x.room > 0.05).sort((a, b) => b.room - a.room)
          for (const { i } of pool) {
            if (need <= 0) break
            const b = homes[i].battery
            const add = Math.min(need, b.maxChg - chg[i], roomKw(i))
            if (add > 0.02) { chg[i] += add; E[i] += add * DT_H * b.eff; need -= add }
          }
          if (!alerted.absorb) { alerted.absorb = true; note(t, `Feeder export ${exportKw.toFixed(0)} kW > ${FEEDER_EXPORT_CAP} kW — coordinated charging started`, 'alert') }
        }
        exportKw = Math.max(0, -feederNow())
        if (exportKw > FEEDER_FLEX_TRIP) {
          let soak = exportKw - FEEDER_FLEX_TRIP
          homes.forEach((h, i) => { if (h.kwp > 0 && flexAdd[i] === 0 && soak > 0) { flexAdd[i] = 0.3; flexKwh += 0.3 * DT_H; soak -= 0.3 } })
          if (!alerted.flexAll) { alerted.flexAll = true; note(t, 'Fleet nearly full — flexible loads (water heating, pumps) soaking surplus', 'info') }
        }
        exportKw = Math.max(0, -feederNow())
        if (exportKw > FEEDER_EXPORT_HARD) {
          let cut = exportKw - FEEDER_EXPORT_HARD
          homes.forEach((h, i) => {
            if (pv[i] <= 0.05 || cut <= 0) return
            const c = Math.min(pv[i] * 0.35, cut)
            curtail[i] += c; pv[i] -= c; cut -= c; curtailedKwh += c * DT_H
          })
          if (!alerted.curAll) { alerted.curAll = true; note(t, `Last resort — feeder export limited to ${FEEDER_EXPORT_HARD} kW (PV curtailment)`, 'warn') }
        }
        for (const dt of SOLAR_DTS) {
          const rating = DT_RATING[dt]
          let exp = Math.max(0, -dtNetNow(dt))
          if (exp > DT_EXPORT_SOFT * rating) {
            let need = exp - DT_EXPORT_SOFT * rating
            for (const i of managed) {
              if (homes[i].dt !== dt || need <= 0) continue
              const b = homes[i].battery
              const add = Math.min(need, b.maxChg - chg[i], roomKw(i))
              if (add > 0.02) { chg[i] += add; E[i] += add * DT_H * b.eff; need -= add }
            }
          }
          exp = Math.max(0, -dtNetNow(dt))
          if (exp > DT_EXPORT_FLEX * rating) {
            homes.forEach((h, i) => {
              if (h.dt === dt && h.kwp > 0 && flexAdd[i] === 0 && exp > DT_EXPORT_FLEX * rating) { flexAdd[i] = 0.3; flexKwh += 0.3 * DT_H; exp -= 0.3 }
            })
          }
          exp = Math.max(0, -dtNetNow(dt))
          if (exp > DT_EXPORT_HARD * rating) {
            let cut = exp - DT_EXPORT_HARD * rating
            homes.forEach((h, i) => {
              if (h.dt !== dt || pv[i] <= 0.05 || cut <= 0) return
              const c = Math.min(pv[i] * 0.45, cut)
              curtail[i] += c; pv[i] -= c; cut -= c; curtailedKwh += c * DT_H
            })
          }
        }
      }

      // ===== EVENING: DT event (hold -> dispatch committed kW) + feeder-head shaving =====
      if (hr >= MATCH_HR && hr < 23.25) {
        // 1) committed homes hold their charge; whenever the measured DT loading goes above the
        //    target they discharge in proportion to their committed share (closed loop on the DT meter)
        for (const ev of events) {
          if (!ev.match) continue
          const members = [...commit.keys()].filter(i => eventOf.get(i) === ev && isManaged(i))
          ev.series = ev.series || new Float64Array(STEPS)
          const prev = t > 0 ? ev.series[t - 1] : 0
          // staggered ramp: total event output changes by at most RAMP_KW per 15 min
          let need = Math.min(dtNetNow(ev.dt) - EVENT_TARGET * DT_RATING[ev.dt], prev + RAMP_KW)
          if (need <= 0) continue
          let pool = members.slice(), used = 0
          for (let pass = 0; pass < 3 && need > 0.05 && pool.length; pass++) {
            const tot = pool.reduce((a, i) => a + commit.get(i), 0)
            const next = []
            let gave = 0
            for (const i of pool) {
              const b = homes[i].battery
              const cap = Math.min(b.maxDis - dis[i], availKwh(i) * 4)
              const want = need * commit.get(i) / tot
              const d = Math.max(0, Math.min(want, cap))
              dis[i] += d; E[i] -= d * DT_H / b.eff; gave += d; if (d > 0.05) vppDis[i] = 1
              if (d >= want - 1e-6 && cap - d > 0.05) next.push(i)
            }
            need -= gave; used += gave; pool = next
          }
          ev.series[t] = used
          if (need > 1 && !alerted['short' + ev.dt]) { alerted['short' + ev.dt] = true; note(t, `DT-${ev.dt + 1}: committed batteries at their limit — ${need.toFixed(0)} kW still above target`, 'warn') }
        }
        // 2) feeder-head peak shaving from uncommitted managed batteries (not on event DTs)
        const feederNet = feederNow()
        if (feederNet > FEEDER_PEAK_CAP) {
          let need = Math.min(feederNet - FEEDER_PEAK_CAP, prevGlobalDis + 40)
          const pool = managed.filter(i => !commit.has(i) && !EVENT_DTS.includes(homes[i].dt))
            .map(i => ({ i, avail: availKwh(i) })).filter(x => x.avail >= MIN_OFFER_KW).sort((a, b) => b.avail - a.avail)
          let used = 0
          for (const { i, avail } of pool) {
            if (need <= 0) break
            const b = homes[i].battery
            const add = Math.min(need, b.maxDis - dis[i], avail * 4)
            if (add > 0.05) { dis[i] += add; E[i] -= add * DT_H / b.eff; need -= add; used += add; vppDis[i] = 1 }
          }
          prevGlobalDis = used
          if (!alerted.shave) { alerted.shave = true; note(t, `Feeder ${feederNet.toFixed(0)} kW > ${FEEDER_PEAK_CAP} kW — coordinated discharge across the fleet`, 'alert') }
        } else prevGlobalDis = Math.max(0, prevGlobalDis - 40)
        // 3) uncommitted managed homes self-consume; on non-event DTs only the energy above what the
        //    feeder peak needs (KEEP_FRAC of capacity is held back for peak shaving)
        for (const i of managed) {
          if (commit.has(i) || dis[i] > 0) continue
          const b = homes[i].battery
          const keep = EVENT_DTS.includes(homes[i].dt) ? 0 : KEEP_FRAC * b.cap
          const spare = Math.max(0, availKwh(i) - keep)
          const deficit = load[i] - pv[i]
          if (deficit > 0 && spare > 0) { const d = Math.min(deficit, b.maxDis, spare * 4); dis[i] = d; E[i] -= d * DT_H / b.eff }
        }
        if (!alerted.comms) { alerted.comms = true; note(t, `House ${SPECIAL.COMMS}: communication lost — local fallback to self-consumption, delivery counted as zero`, 'edge') }
      }
      if (!alerted.rebound && hr >= 23.25) { alerted.rebound = true; note(t, 'Anti-rebound: recharge waits for tomorrow’s solar — no post-event grid spike', 'info') }
    }

    // -- bookkeeping --
    let feederNet = 0
    const dtNet = new Float64Array(N_DT)
    homes.forEach((h, i) => {
      const net = load[i] + flexAdd[i] - pv[i] + chg[i] - dis[i]
      feederNet += net; dtNet[h.dt] += net
    })
    steps.push({
      t, hr, feederNet,
      dtNet: Array.from(dtNet),
      soc: homes.map((h, i) => E[i] / h.battery.cap),
      chg: Array.from(chg), dis: Array.from(dis),
      pvTot: pv.reduce((a, b) => a + b, 0),
      loadTot: load.reduce((a, b) => a + b, 0),
      curtail: Array.from(curtail),
      flex: Array.from(flexAdd),
      vpp: vppDis,
    })
  }
  return { steps, log, curtailedKwh, flexKwh, events }
}

// ---------- public API ----------
export function buildSimulation(seed = 20260927, overrides = {}) {
  const homes = buildFleet(seed, overrides)
  const withOut = run(homes, { vpp: false })
  // plan the feeder-head target: the lowest cap (10 kW steps) the fleet's energy can actually hold
  let lo = 0.6 * Math.max(...withOut.steps.map(s => s.feederNet)), hi = Math.max(...withOut.steps.map(s => s.feederNet))
  let withVpp = run(homes, { vpp: true, forecast: withOut.steps, peakCap: hi })
  while (hi - lo > 10) {
    const mid = (lo + hi) / 2
    const r = run(homes, { vpp: true, forecast: withOut.steps, peakCap: mid })
    if (Math.max(...r.steps.map(s => s.feederNet)) <= mid + 2) { hi = mid; withVpp = r } else lo = mid
  }
  const feederCapKw = hi

  const metricsOf = scen => {
    const nets = scen.steps.map(s => s.feederNet)
    const peak = Math.max(...nets)
    const reverse = Math.min(...nets)
    const exported = scen.steps.reduce((a, s) => a + Math.max(0, -s.feederNet) * DT_H, 0)
    let maxDtPct = 0, maxDtRevPct = 0, worstDt = 0
    scen.steps.forEach(s => s.dtNet.forEach((n, d) => {
      const p = 100 * n / DT_RATING[d]
      if (p > maxDtPct) { maxDtPct = p; worstDt = d }
      maxDtRevPct = Math.max(maxDtRevPct, 100 * -n / DT_RATING[d])
    }))
    return { peakKw: peak, reverseKw: reverse, exportedKwh: exported, maxDtPct, maxDtRevPct, worstDt }
  }
  const A = metricsOf(withOut), B = metricsOf(withVpp)
  const peakT = withOut.steps.reduce((best, s) => (s.feederNet > withOut.steps[best].feederNet ? s.t : best), 0)

  // per-home verification for each event: delivered = (event discharge − baseline discharge) × time.
  // Baseline = what the same battery did in the business-as-usual run (a real pilot would estimate it
  // from the home's own recent history; here the simulator knows it exactly).
  const events = withVpp.events.map(ev => {
    const active = [...ev.series].map((v, t) => (v > 0.05 ? t : -1)).filter(t => t >= 0)
    ev = { ...ev, activeStart: active[0], activeEnd: active[active.length - 1] + 1, series: Array.from(ev.series) }
    const perHome = ev.match.rows.filter(r => r.allocKw > 0).map(r => {
      const i = r.id - 1
      let act = 0, base = 0
      for (let t = ev.activeStart; t < ev.activeEnd; t++) { act += withVpp.steps[t].dis[i] * DT_H; base += withOut.steps[t].dis[i] * DT_H }
      const hrs = (ev.activeEnd - ev.activeStart) * DT_H
      return { id: r.id, committedKw: r.allocKw, actualKw: act / hrs, baselineKw: base / hrs, deliveredKwh: Math.max(0, act - base), actualKwh: act, baselineKwh: base }
    })
    const peakWith = Math.max(...withVpp.steps.slice(ev.startStep, ev.endStep).map(s => s.dtNet[ev.dt]))
    return {
      ...ev,
      perHome,
      deliveredKwh: perHome.reduce((a, p) => a + p.deliveredKwh, 0),
      dischargedKwh: perHome.reduce((a, p) => a + p.actualKwh, 0),
      activeHours: (ev.activeEnd - ev.activeStart) * DT_H,
      peakWithKw: peakWith,
      peakWithoutKw: Math.max(...withOut.steps.slice(ev.startStep, ev.endStep).map(s => s.dtNet[ev.dt])),
    }
  })
  const hero = events.find(e => e.dt === HERO_DT)
  const s137 = hero?.perHome.find(p => p.id === SPECIAL.SETTLED)
  const settlement = s137 && {
    homeId: SPECIAL.SETTLED, windowH: hero.activeHours, startHr: hero.activeStart * DT_H, endHr: hero.activeEnd * DT_H,
    requestedKw: s137.committedKw, actualKw: s137.actualKw, baselineKw: s137.baselineKw, deliveredKwh: s137.deliveredKwh,
  }

  return {
    homes, dtRating: DT_RATING,
    without: withOut, withVpp,
    metrics: { without: A, withVpp: B },
    curtailedKwh: withVpp.curtailedKwh,
    flexKwh: withVpp.flexKwh,
    settlement, peakT, events, hero, feederCapKw,
  }
}
