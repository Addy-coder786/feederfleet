/**
 * FeederFleet — day simulation engine.
 * SIMULATED / CONCEPTUAL. A synthetic 22 kV feeder for the proposed Wakad–Tathawade (Pune) pilot area:
 *   500 homes, 12 distribution transformers (DTs), 103 VPP-controllable lithium batteries (scenario
 *   assumption); the rest are monitor-only. Every number comes from src/config/scenario.js and is
 *   synthetic or an assumption — nothing here is an MSEDCL measurement.
 *
 * Two runs over one day in 15-minute steps (96 steps):
 *   WITHOUT — every battery runs plain self-consumption (today's behaviour).
 *   WITH    — FeederFleet coordinates the controllable subset:
 *             midday: paced charging -> enrolled flexible loads -> export limit (last resort);
 *             evening: a DT-targeted event on each DT forecast to overload
 *             (forecast -> match -> hold -> dispatch -> detect dropouts -> replan),
 *             plus feeder-head peak shaving, always above each owner's reserve.
 *
 * Sign convention (engine): net > 0 = the home/DT IMPORTS from the grid; net < 0 = exports (reverse flow).
 */
import {
  STEPS, DT_H, DT_CFG, HERO_DT, BATTERY, HOME, GRID, CONTROL, SPECIAL, STORY_OVERRIDES, FAILURES,
  SCENARIOS, DEFAULT_SCENARIO_ID,
} from '../config/scenario.js'

export { STEPS, DT_H, HERO_DT, SPECIAL, SCENARIOS, DEFAULT_SCENARIO_ID }

// ---------- deterministic RNG ----------
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const N_DT = DT_CFG.length
export const N_HOMES = DT_CFG.reduce((a, d) => a + d.homes, 0) // 500
export const DT_RATING = DT_CFG.map(d => d.kva)                 // kVA (nameplate)
export const DT_HOMES = DT_CFG.map(d => d.homes)
export const PF = GRID.dtPowerFactor
export const DT_KW_LIMIT = DT_RATING.map(kva => kva * PF)       // kW that loads the DT to 100 % of its kVA rating
/** DT loading in % of its kVA rating, from real power (kW) at the assumed power factor. Negative = reverse flow. */
export const dtLoadPct = (kw, dt) => (100 * kw) / DT_KW_LIMIT[dt]

export const EVENT_TRIP = CONTROL.eventTrip
export const EVENT_TARGET = CONTROL.eventTarget
export const MATCH_HR = CONTROL.matchHr
export const RAMP_KW = CONTROL.rampKwPerStep
export const MATCH_MARGIN = CONTROL.matchMargin
export const MIN_OFFER_KW = CONTROL.minOfferKw
const STEPS_PER_H = 1 / DT_H

/** Offline (no heartbeat) at this hour, per the failure model. Applies to the WITH-VPP run only. */
export const isOfflineAt = (id, hr) => FAILURES.offline.some(f => f.id === id && hr >= f.fromHr - 1e-9)
export const offlineSince = id => FAILURES.offline.find(f => f.id === id)?.fromHr ?? null
const partialFactor = id => FAILURES.partial.find(f => f.id === id)?.factor ?? 1

const gauss = (h, mu, sigma) => Math.exp(-((h - mu) ** 2) / (2 * sigma * sigma))

const DEFAULT_SCN = SCENARIOS[DEFAULT_SCENARIO_ID]
/** Normalised PV shape (0–1) between the effective start and end of PV production (h). */
export function solarShape(h, start = DEFAULT_SCN.pvStartHr, end = DEFAULT_SCN.pvEndHr) {
  if (h < start || h > end) return 0
  return Math.max(0, Math.sin(Math.PI * (h - start) / (end - start))) ** 1.3
}
/** kW per kWp at shape = 1 so that one kWp yields `pvYield` kWh over the day (pvNoise = 1). */
export function pvScaleFor(scn) {
  let area = 0
  for (let h = 0; h < 24; h += 0.01) area += solarShape(h + 0.005, scn.pvStartHr, scn.pvEndHr) * 0.01 // h
  return scn.pvYield.value / area
}

// ---------- fleet ----------
export function buildFleet(seed = DEFAULT_SCN.seed, overrides = {}, scn = DEFAULT_SCN) {
  const rnd = mulberry32(seed)
  const pvScale = pvScaleFor(scn)
  const r = ([lo, hi]) => lo + rnd() * (hi - lo)
  const homes = []
  let id = 1
  DT_CFG.forEach((c, dt) => {
    for (let i = 0; i < c.homes; i++) {
      const hasSolar = i < c.solar
      homes.push({
        id: id++, dt, phase: ['R', 'Y', 'B'][i % 3],
        kwp: hasSolar ? r(HOME.kwp) : 0,
        pvNoise: r(HOME.pvNoise),
        base: r(HOME.baseKw),
        morning: r(HOME.morningKw),
        ac: r(c.ac) * scn.acScale,
        acMu: c.acMu ?? HOME.acMu, acSig: c.acSig ?? HOME.acSig,
        pvScale, pvStart: scn.pvStartHr, pvEnd: scn.pvEndHr,
        battery: null,
      })
    }
  })
  DT_CFG.forEach((c, dt) => {
    const inDt = homes.filter(h => h.dt === dt)
    // controllable lithium first on solar homes, then the rest are monitor-only
    inDt.forEach((h, k) => {
      if (k < c.li) {
        const spec = k < c.li10 ? BATTERY.li10 : BATTERY.li5
        h.battery = { ...spec, soc0: r(BATTERY.liSoc0) }
      } else {
        // non-solar lead-acid = classic inverter UPS: float-charged, used only in outages
        h.battery = { ...BATTERY.pb, idle: h.kwp === 0 }
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
  for (const [hid, v] of Object.entries(STORY_OVERRIDES.reserve)) homes[hid - 1].battery.reserve = v // cautious owner
  for (const [hid, v] of Object.entries(STORY_OVERRIDES.soc0)) homes[hid - 1].battery.soc0 = v       // started nearly full
  for (const [hid, v] of Object.entries(overrides.reserve || {})) homes[hid - 1].battery.reserve = v // homeowner reserve slider
  return homes
}

export const homeLoad = (h, hr) =>
  h.base
  + h.morning * gauss(hr, 7.6, 1.3)
  + 0.18 * gauss(hr, 13.0, 2.2)
  + h.ac * (gauss(hr, h.acMu, h.acSig) + 0.16 * gauss(hr, 23.2, 1.1))

export const homePv = (h, hr) => h.kwp * h.pvScale * solarShape(hr, h.pvStart, h.pvEnd) * h.pvNoise

/**
 * THE MATCHING RULES (one function, used by the engine, the replan and the DISCOM panel).
 * candidate: { id, dt, controllable, online, soc, reserve, floor, cap, eff, maxDis, maxChg }
 * kind 'support' = discharge to relieve an overload; 'absorb' = charge to soak surplus.
 * Rules, in order: controllable inverter · online · above reserve / not full ·
 * sufficient energy for the whole event. Offer = min(inverter kW, usable kWh ÷ hours).
 * Allocation: local merit order — biggest offer first (ties: lower id), whole offers (compared to
 * 0.1 kW), until the request plus a 10 % margin for non-delivery is covered. The rest stay on STANDBY
 * and are called by the replan if a selected home drops out.
 */
export function evaluateCandidates(cands, { kind, requiredKw, hours }) {
  const rows = cands.map(c => {
    const row = { ...c, offerKw: 0, allocKw: 0, usableKwh: 0 }
    if (!c.controllable) return { ...row, verdict: 'monitor', reason: 'Not controllable (monitor-only)' }
    if (!c.online) return { ...row, verdict: 'offline', reason: 'Offline — no heartbeat' }
    if (kind === 'support') {
      const usable = Math.max(0, (c.soc - Math.max(c.floor, c.reserve)) * c.cap * c.eff) // kWh deliverable
      row.usableKwh = usable
      if (c.reserve >= 0.5 && usable < MIN_OFFER_KW * hours) return { ...row, verdict: 'reserve', reason: `Reserve protected (owner keeps ${Math.round(c.reserve * 100)}%)` }
      const offer = Math.min(c.maxDis, usable / hours) // kW = kWh ÷ h
      if (offer < MIN_OFFER_KW) return { ...row, verdict: 'low', reason: 'Too little energy above reserve' }
      row.offerKw = offer
    } else {
      const room = Math.max(0, (BATTERY.socMax - c.soc) * c.cap / c.eff) // kWh drawn to fill
      row.usableKwh = room
      const offer = Math.min(c.maxChg, room / hours)
      if (offer < CONTROL.minAbsorbKw) return { ...row, verdict: 'full', reason: 'Battery full — cannot absorb' }
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
  return { rows, offeredKw: offered, targetKw: target, matchedKw: got, shortfallKw: Math.max(0, requiredKw - got) }
}

// ---------- event planning (from the forecast) ----------
/**
 * Trip detection uses the business-as-usual forecast (every battery self-consumes).
 * Sizing uses the same forecast PLUS the self-use discharge of the DT's controllable batteries,
 * because committed batteries hold their charge until the DT needs it — so the DT sees that load.
 * A seeded day-level error (± forecastErrorPct) stands in for forecast uncertainty; the engine never
 * sees the true future except through this imperfect forecast.
 */
function planEvents(homes, withOut, seed) {
  const bias = (mulberry32(seed ^ 0x9E3779B9)() * 2 - 1) * CONTROL.forecastErrorPct / 100
  const matchStep = Math.round(MATCH_HR * STEPS_PER_H)
  const events = []
  for (let dt = 0; dt < N_DT; dt++) {
    const lim = DT_KW_LIMIT[dt]
    const ctrl = homes.map((h, i) => (h.dt === dt && h.battery.controllable ? i : -1)).filter(i => i >= 0)
    const bau = withOut.steps.map(s => s.dtNet[dt] * (1 + bias))
    const held = withOut.steps.map((s, t) => (t >= matchStep ? (s.dtNet[dt] + ctrl.reduce((a, i) => a + s.dis[i], 0)) * (1 + bias) : bau[t]))
    let pk = -1
    for (let t = 17 * STEPS_PER_H; t < STEPS; t++) if (pk < 0 || bau[t] > bau[pk]) pk = t
    if (bau[pk] <= EVENT_TRIP * lim) continue
    let hp = pk
    for (let t = matchStep; t < STEPS; t++) if (held[t] > held[hp]) hp = t
    let a = hp, b = hp
    while (a > matchStep && held[a - 1] > EVENT_TARGET * lim) a--
    while (b < STEPS - 1 && held[b + 1] > EVENT_TARGET * lim) b++
    const requiredKw = Math.max(...held.slice(a, b + 1).map(n => n - EVENT_TARGET * lim))
    events.push({
      dt, startStep: a, endStep: b + 1, hours: (b + 1 - a) * DT_H, requiredKw: Math.ceil(requiredKw),
      forecastPeakKw: bau[pk], forecastPeakStep: pk, forecastBiasPct: 100 * bias,
    })
  }
  return events
}

// ---------- scenario run ----------
function run(homes, { vpp, plan = [], peakCap = Infinity }) {
  const FEEDER_PEAK_CAP = peakCap
  const N = homes.length
  const E = homes.map(h => h.battery.soc0 * h.battery.cap)                                  // kWh stored
  const floorE = homes.map(h => Math.max(h.battery.floor, h.battery.reserve) * h.battery.cap) // kWh never used
  const capE = homes.map(h => BATTERY.socMax * h.battery.cap)
  const availKwh = i => Math.max(0, (E[i] - floorE[i]) * homes[i].battery.eff)   // kWh deliverable (AC side)
  const roomKw = i => Math.max(0, (capE[i] - E[i]) * STEPS_PER_H / homes[i].battery.eff) // kW to fill in one step
  const flexUsedH = new Float64Array(N)

  const steps = [], log = []
  let curtailedKwh = 0, flexKwh = 0, prevGlobalDis = 0
  const alerted = {}
  const note = (t, msg, kind = 'info') => log.push({ t, msg, kind })

  const events = vpp ? plan.map(e => ({ ...e, series: new Float64Array(STEPS), replans: [], dropped: [] })) : []
  const eventDts = new Set(events.map(e => e.dt))
  const commit = new Map()  // home index -> committed kW
  const eventOf = new Map() // home index -> event
  const standby = new Map() // home index -> event (held, callable by the replan)
  const wasActive = new Uint8Array(N)

  const offline = (i, hr) => vpp && isOfflineAt(homes[i].id, hr)
  const isManaged = (i, hr) => vpp && homes[i].battery.controllable && !offline(i, hr)
  const candidateOf = (i, hr) => {
    const h = homes[i], b = h.battery
    return {
      id: h.id, dt: h.dt, controllable: b.controllable, online: !offline(i, hr), soc: E[i] / b.cap,
      reserve: b.reserve, floor: b.floor, cap: b.cap, eff: b.eff, maxDis: b.maxDis, maxChg: b.maxChg, type: b.type,
    }
  }

  for (let t = 0; t < STEPS; t++) {
    const hr = t * DT_H
    const pv = homes.map(h => homePv(h, hr))
    const load = homes.map(h => homeLoad(h, hr))
    const chg = new Float64Array(N)
    const dis = new Float64Array(N)
    const flexAdd = new Float64Array(N)
    const curtail = new Float64Array(N)
    const vppDis = new Uint8Array(N) // 1 = discharge requested by the VPP (event or feeder peak)
    const managedAt = i => isManaged(i, hr)

    // ---- matching at MATCH_HR (state = start of this step) ----
    if (vpp && Math.abs(hr - MATCH_HR) < 1e-9) {
      for (const ev of events) {
        const cands = homes.map((h, i) => ({ h, i })).filter(({ h }) => h.dt === ev.dt).map(({ i }) => candidateOf(i, hr))
        const res = evaluateCandidates(cands, { kind: 'support', requiredKw: ev.requiredKw, hours: ev.hours })
        ev.match = { ...res, stepIdx: t }
        res.rows.forEach(r => {
          if (r.allocKw > 0) { commit.set(r.id - 1, r.allocKw); eventOf.set(r.id - 1, ev) }
          else if (r.verdict === 'standby') standby.set(r.id - 1, ev)
        })
        note(t, `DT-${ev.dt + 1}: forecast ${Math.round(dtLoadPct(ev.forecastPeakKw, ev.dt))}% of rating → request ${ev.requiredKw} kW for ${ev.hours * 60} min · matched ${res.matchedKw.toFixed(1)} kW from ${res.rows.filter(r => r.allocKw > 0).length} homes`, 'alert')
      }
    }

    // -- self-consumption for unmanaged batteries --
    homes.forEach((h, i) => {
      const b = h.battery
      if (managedAt(i) || b.idle) return
      const excess = pv[i] - load[i]
      if (excess > 0) {
        const c = Math.min(excess, b.maxChg, roomKw(i))
        chg[i] = c; E[i] += c * DT_H * b.eff
      } else {
        const d = Math.min(-excess, b.maxDis, availKwh(i) * STEPS_PER_H)
        dis[i] = d; E[i] -= d * DT_H / b.eff
      }
    })

    if (vpp) {
      const managed = homes.map((_, i) => i).filter(managedAt)
      const netOf = i => load[i] + flexAdd[i] - pv[i] + chg[i] - dis[i]
      const dtNetNow = dt => homes.reduce((a, h, i) => a + (h.dt === dt ? netOf(i) : 0), 0)
      const feederNow = () => homes.reduce((a, _, i) => a + netOf(i), 0)
      // most a battery may add right now: inverter limit, energy above reserve, and (no-export rule) the home's own import
      const disCap = i => Math.max(0, Math.min(
        homes[i].battery.maxDis - dis[i], availKwh(i) * STEPS_PER_H,
        CONTROL.noExportDuringDispatch ? netOf(i) : Infinity))
      const canFlex = i => homes[i].kwp > 0 && flexAdd[i] === 0 && flexUsedH[i] + DT_H <= CONTROL.flexMaxH + 1e-9
      const addFlex = i => { flexAdd[i] = CONTROL.flexKw; flexUsedH[i] += DT_H; flexKwh += CONTROL.flexKw * DT_H }

      // ===== own-surplus charging (10:30 → sunset); morning headroom kept for the solar peak =====
      if (hr >= 10.5 && hr < MATCH_HR) {
        const ramp = Math.min(1, (hr - 10.25) / 1.25) // eased in 10:30 → 11:30 (no step change on the feeder)
        for (const i of managed) {
          const b = homes[i].battery
          const surplus = pv[i] - load[i]
          if (surplus > 0) { const c = Math.min(surplus * ramp, b.maxChg, roomKw(i)); chg[i] = c; E[i] += c * DT_H * b.eff }
        }
      }
      // ===== before evening: managed homes self-consume normally (from 16:00) =====
      if (hr < MATCH_HR) {
        for (const i of managed) {
          const b = homes[i].battery
          const deficit = load[i] - pv[i]
          if (deficit > 0 && chg[i] === 0 && hr >= 16) { const d = Math.min(deficit, b.maxDis, availKwh(i) * STEPS_PER_H); dis[i] = d; E[i] -= d * DT_H / b.eff }
        }
      }

      // ===== MIDDAY (10:00–16:00): absorb -> flex -> export-limit, enrolled homes only =====
      if (hr >= 10.0 && hr < 16.0) {
        let exportKw = Math.max(0, -feederNow())
        if (exportKw > GRID.feederExportCapKw) {
          let need = (exportKw - GRID.feederExportCapKw) * (hr < 12.0 ? 0.5 : 1.0)
          const pool = managed.map(i => ({ i, room: roomKw(i) })).filter(x => x.room > 0.05).sort((a, b) => b.room - a.room)
          for (const { i } of pool) {
            if (need <= 0) break
            const b = homes[i].battery
            const add = Math.min(need, b.maxChg - chg[i], roomKw(i))
            if (add > 0.02) { chg[i] += add; E[i] += add * DT_H * b.eff; need -= add }
          }
          if (!alerted.absorb) { alerted.absorb = true; note(t, `Feeder export ${exportKw.toFixed(0)} kW > ${GRID.feederExportCapKw} kW — coordinated charging started`, 'alert') }
        }
        exportKw = Math.max(0, -feederNow())
        if (exportKw > GRID.feederFlexTripKw) {
          let soak = exportKw - GRID.feederFlexTripKw
          for (const i of managed) { if (soak <= 0) break; if (canFlex(i)) { addFlex(i); soak -= CONTROL.flexKw } }
          if (!alerted.flexAll) { alerted.flexAll = true; note(t, 'Fleet nearly full — enrolled flexible loads (water heating, pumps) soaking surplus', 'info') }
        }
        exportKw = Math.max(0, -feederNow())
        if (exportKw > GRID.feederExportHardKw) {
          let cut = exportKw - GRID.feederExportHardKw
          for (const i of managed) {
            if (pv[i] <= 0.05 || cut <= 0) continue
            const c = Math.min(pv[i] * 0.35, cut)
            curtail[i] += c; pv[i] -= c; cut -= c; curtailedKwh += c * DT_H
          }
          if (!alerted.curAll) { alerted.curAll = true; note(t, `Last resort — feeder export limited to ${GRID.feederExportHardKw} kW (controllable inverters only)`, 'warn') }
          if (cut > 1 && !alerted.curShort) { alerted.curShort = true; note(t, `Export limit not fully met — ${cut.toFixed(0)} kW above it, no more controllable inverters`, 'warn') }
        }
        for (let dt = 0; dt < N_DT; dt++) {
          const lim = DT_KW_LIMIT[dt]
          let exp = Math.max(0, -dtNetNow(dt))
          if (exp > GRID.dtExportSoft * lim) {
            let need = exp - GRID.dtExportSoft * lim
            for (const i of managed) {
              if (homes[i].dt !== dt || need <= 0) continue
              const b = homes[i].battery
              const add = Math.min(need, b.maxChg - chg[i], roomKw(i))
              if (add > 0.02) { chg[i] += add; E[i] += add * DT_H * b.eff; need -= add }
            }
          }
          exp = Math.max(0, -dtNetNow(dt))
          if (exp > GRID.dtExportFlex * lim) {
            for (const i of managed) {
              if (homes[i].dt === dt && exp > GRID.dtExportFlex * lim && canFlex(i)) { addFlex(i); exp -= CONTROL.flexKw }
            }
          }
          exp = Math.max(0, -dtNetNow(dt))
          if (exp > GRID.dtExportHard * lim) {
            let cut = exp - GRID.dtExportHard * lim
            for (const i of managed) {
              if (homes[i].dt !== dt || pv[i] <= 0.05 || cut <= 0) continue
              const c = Math.min(pv[i] * 0.45, cut)
              curtail[i] += c; pv[i] -= c; cut -= c; curtailedKwh += c * DT_H
            }
          }
        }
      }

      // ===== EVENING: DT events (detect dropouts -> replan -> dispatch) + feeder-head shaving =====
      if (hr >= MATCH_HR && hr < CONTROL.eveningEndHr) {
        for (const ev of events) {
          if (!ev.match) continue
          // 1) dropout detection + replan, on the CURRENT state (SoC now, who is online now)
          const lost = [...commit.keys()].filter(i => eventOf.get(i) === ev && !managedAt(i) && !ev.dropped.includes(homes[i].id))
          if (lost.length) {
            const lostKw = lost.reduce((a, i) => a + commit.get(i), 0)
            lost.forEach(i => ev.dropped.push(homes[i].id))
            const hoursLeft = Math.max(DT_H, (ev.endStep - t) * DT_H)
            const pool = homes.map((h, i) => i).filter(i => homes[i].dt === ev.dt && !commit.has(i))
            const res = evaluateCandidates(pool.map(i => candidateOf(i, hr)), { kind: 'support', requiredKw: lostKw, hours: hoursLeft })
            const added = res.rows.filter(r => r.allocKw > 0)
            added.forEach(r => { commit.set(r.id - 1, r.allocKw); eventOf.set(r.id - 1, ev); standby.delete(r.id - 1) })
            ev.replans.push({ t, droppedIds: lost.map(i => homes[i].id), lostKw, hoursLeft, added: added.map(r => ({ id: r.id, kw: r.allocKw })), shortfallKw: res.shortfallKw })
            note(t, `DT-${ev.dt + 1}: home${lost.length > 1 ? 's' : ''} ${lost.map(i => '#' + homes[i].id).join(', ')} stopped responding (−${lostKw.toFixed(1)} kW) → replanned: ${added.length ? added.map(r => `#${r.id} +${r.allocKw.toFixed(1)} kW`).join(', ') : 'no eligible home left'}`, added.length ? 'alert' : 'warn')
          }
          // 2) closed loop on the DT meter: committed homes discharge in proportion to their commitment
          const members = [...commit.keys()].filter(i => eventOf.get(i) === ev && managedAt(i))
          const prev = t > 0 ? ev.series[t - 1] : 0
          let need = Math.min(dtNetNow(ev.dt) - EVENT_TARGET * DT_KW_LIMIT[ev.dt], prev + RAMP_KW) // staggered ramp
          if (need <= 0) continue
          let pool = members.slice(), used = 0
          for (let pass = 0; pass < 3 && need > 0.05 && pool.length; pass++) {
            const tot = pool.reduce((a, i) => a + commit.get(i), 0)
            const next = []
            let gave = 0
            for (const i of pool) {
              const b = homes[i].battery
              const cap = disCap(i)
              const want = need * commit.get(i) / tot
              let d = Math.max(0, Math.min(want, cap)) * partialFactor(homes[i].id)
              if (!wasActive[i] && d > 0) d *= (15 - CONTROL.responseDelayMin) / 15 // response delay on first activation
              dis[i] += d; E[i] -= d * DT_H / b.eff; gave += d; if (d > 0.05) { vppDis[i] = 1; wasActive[i] = 1 }
              if (d >= want - 1e-6 && cap - d > 0.05) next.push(i)
            }
            need -= gave; used += gave; pool = next
          }
          ev.series[t] = used
          if (need > 1 && !alerted['short' + ev.dt]) { alerted['short' + ev.dt] = true; note(t, `DT-${ev.dt + 1}: committed batteries at their limit — ${need.toFixed(0)} kW still above target`, 'warn') }
        }
        // 3) feeder-head peak shaving from managed batteries not tied to a DT event
        const feederNet = feederNow()
        if (feederNet > FEEDER_PEAK_CAP) {
          let need = Math.min(feederNet - FEEDER_PEAK_CAP, prevGlobalDis + CONTROL.feederRampKwPerStep)
          const pool = managed.filter(i => !commit.has(i) && !standby.has(i) && !eventDts.has(homes[i].dt))
            .map(i => ({ i, avail: availKwh(i) })).filter(x => x.avail >= MIN_OFFER_KW).sort((a, b) => b.avail - a.avail)
          let used = 0
          for (const { i } of pool) {
            if (need <= 0) break
            const b = homes[i].battery
            const add = Math.min(need, disCap(i))
            if (add > 0.05) { dis[i] += add; E[i] -= add * DT_H / b.eff; need -= add; used += add; vppDis[i] = 1 }
          }
          prevGlobalDis = used
          if (!alerted.shave) { alerted.shave = true; note(t, `Feeder ${feederNet.toFixed(0)} kW > ${FEEDER_PEAK_CAP.toFixed(0)} kW — coordinated discharge across the fleet`, 'alert') }
        } else prevGlobalDis = Math.max(0, prevGlobalDis - CONTROL.feederRampKwPerStep)
        // 4) other managed homes self-consume. Committed + standby homes hold until their event's planned end.
        //    On non-event DTs only energy above KEEP_FRAC of capacity is used (held back for the feeder peak).
        for (const i of managed) {
          if (dis[i] > 0) continue
          const ev = eventOf.get(i) || standby.get(i)
          if (ev && t < ev.endStep) continue
          const b = homes[i].battery
          const keep = eventDts.has(homes[i].dt) ? 0 : CONTROL.keepFrac * b.cap
          const spare = Math.max(0, availKwh(i) - keep)
          const deficit = load[i] - pv[i]
          if (deficit > 0 && spare > 0) { const d = Math.min(deficit, b.maxDis, spare * STEPS_PER_H); dis[i] = d; E[i] -= d * DT_H / b.eff }
        }
      }
      for (const f of FAILURES.offline) {
        if (!alerted['off' + f.id] && hr >= f.fromHr - 1e-9) {
          alerted['off' + f.id] = true
          note(t, `House ${f.id}: communication lost — local fallback to self-consumption, delivery counted as zero`, 'edge')
        }
      }
      if (!alerted.rebound && hr >= CONTROL.eveningEndHr) { alerted.rebound = true; note(t, 'Anti-rebound: recharge waits for tomorrow’s solar — no post-event grid spike', 'info') }
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
  for (const ev of events) ev.memberIds = [...commit.keys()].filter(i => eventOf.get(i) === ev).map(i => homes[i].id)
  return { steps, log, curtailedKwh, flexKwh, events }
}

// ---------- public API ----------
/**
 * Build one simulated day.
 * @param seed     RNG seed (fleet + forecast error). Same seed + scenario + overrides → identical result.
 * @param overrides { reserve: { [homeId]: frac } } — homeowner reserve slider
 * @param scenarioId key of SCENARIOS (src/config/scenario.js)
 */
export function buildSimulation(seed, overrides = {}, scenarioId = DEFAULT_SCENARIO_ID) {
  const scenario = SCENARIOS[scenarioId]
  if (!scenario) throw new Error(`Unknown scenario "${scenarioId}"`)
  seed = seed ?? scenario.seed
  const homes = buildFleet(seed, overrides, scenario)
  const withOut = run(homes, { vpp: false })
  const plan = planEvents(homes, withOut, seed)
  // feeder-head target: the lowest cap (10 kW steps) the fleet's energy can hold.
  // NOTE: found by re-running the day (hindsight) — an optimistic planning bound, labelled as such in the UI.
  const peakOf = r => Math.max(...r.steps.map(s => s.feederNet))
  let lo = 0.6 * peakOf(withOut), hi = peakOf(withOut)
  let withVpp = run(homes, { vpp: true, plan, peakCap: hi })
  while (hi - lo > 10) {
    const mid = (lo + hi) / 2
    const r = run(homes, { vpp: true, plan, peakCap: mid })
    if (peakOf(r) <= mid + 2) { hi = mid; withVpp = r } else lo = mid
  }
  const feederCapKw = hi

  const metricsOf = scen => {
    const nets = scen.steps.map(s => s.feederNet)
    const exported = scen.steps.reduce((a, s) => a + Math.max(0, -s.feederNet) * DT_H, 0)
    let maxDtPct = -Infinity, maxDtRevPct = 0, worstDt = 0
    scen.steps.forEach(s => s.dtNet.forEach((n, d) => {
      const p = dtLoadPct(n, d)
      if (p > maxDtPct) { maxDtPct = p; worstDt = d }
      maxDtRevPct = Math.max(maxDtRevPct, -p)
    }))
    return { peakKw: Math.max(...nets), reverseKw: Math.min(...nets), exportedKwh: exported, maxDtPct, maxDtRevPct, worstDt }
  }
  const A = metricsOf(withOut), B = metricsOf(withVpp)
  const peakT = withOut.steps.reduce((best, s) => (s.feederNet > withOut.steps[best].feederNet ? s.t : best), 0)

  // per-home verification for each event: delivered = Σ (event discharge − baseline discharge) × 0.25 h,
  // over the active window, counting ONLY steps with telemetry (offline steps count as zero).
  // Baseline = the same battery in the business-as-usual run (a real pilot must estimate it, e.g. from
  // similar non-event days; the simulator knows it exactly — an optimistic simplification).
  const events = withVpp.events.filter(ev => ev.match).map(ev => {
    const active = [...ev.series].map((v, t) => (v > 0.05 ? t : -1)).filter(t => t >= 0)
    const activeStart = active.length ? active[0] : ev.startStep
    const activeEnd = active.length ? active[active.length - 1] + 1 : ev.startStep
    const hrs = Math.max(DT_H, (activeEnd - activeStart) * DT_H)
    const addedBy = new Map(ev.replans.flatMap(rp => rp.added.map(a => [a.id, rp])))
    const perHome = ev.memberIds.map(id => {
      const i = id - 1
      const alloc = ev.match.rows.find(r => r.id === id)?.allocKw || addedBy.get(id)?.added.find(a => a.id === id)?.kw || 0
      let act = 0, base = 0, gapSteps = 0
      for (let t = activeStart; t < activeEnd; t++) {
        if (isOfflineAt(id, t * DT_H)) { gapSteps++; continue }
        act += withVpp.steps[t].dis[i] * DT_H; base += withOut.steps[t].dis[i] * DT_H
      }
      return {
        id, committedKw: alloc, actualKw: act / hrs, baselineKw: base / hrs, deliveredKwh: Math.max(0, act - base),
        actualKwh: act, baselineKwh: base, gapSteps, droppedOut: ev.dropped.includes(id),
        replanStep: addedBy.get(id)?.t ?? null, partial: partialFactor(id) < 1,
      }
    })
    const win = withVpp.steps.slice(ev.startStep, ev.endStep), win0 = withOut.steps.slice(ev.startStep, ev.endStep)
    return {
      ...ev, series: Array.from(ev.series), activeStart, activeEnd, activeHours: active.length ? hrs : 0,
      perHome,
      deliveredKwh: perHome.reduce((a, p) => a + p.deliveredKwh, 0),
      dischargedKwh: perHome.reduce((a, p) => a + p.actualKwh, 0),
      peakWithKw: Math.max(...win.map(s => s.dtNet[ev.dt])),
      peakWithoutKw: Math.max(...win0.map(s => s.dtNet[ev.dt])),
    }
  })
  const hero = events.find(e => e.dt === HERO_DT) || events[0] || null
  const sp = hero?.perHome.find(p => p.id === SPECIAL.SETTLED)
  const settlement = sp && hero.activeHours > 0 ? {
    homeId: SPECIAL.SETTLED, windowH: hero.activeHours, startHr: hero.activeStart * DT_H, endHr: hero.activeEnd * DT_H,
    requestedKw: sp.committedKw, actualKw: sp.actualKw, baselineKw: sp.baselineKw, deliveredKwh: sp.deliveredKwh,
  } : null

  return {
    scenario, seed,
    homes, dtRating: DT_RATING, dtKwLimit: DT_KW_LIMIT, pf: PF,
    without: withOut, withVpp,
    metrics: { without: A, withVpp: B },
    curtailedKwh: withVpp.curtailedKwh,
    flexKwh: withVpp.flexKwh,
    settlement, peakT, events, hero, feederCapKw,
  }
}
