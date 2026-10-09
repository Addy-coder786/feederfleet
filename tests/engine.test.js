import { describe, it, expect, afterEach } from 'vitest'
import {
  buildSimulation, buildFleet, evaluateCandidates, dtLoadPct, pvScaleFor, homePv, homeLoad, isOfflineAt,
  SCENARIOS, DEFAULT_SCENARIO_ID, STEPS, DT_H, N_HOMES, N_DT, DT_RATING, DT_KW_LIMIT, PF, HERO_DT, SPECIAL,
} from '../src/sim/engine.js'
import { DT_CFG, BATTERY, CONTROL, FAILURES } from '../src/config/scenario.js'
import { payFor, RATE_PER_KWH, discomValue, EVENTS_PER_YEAR } from '../src/data/econ.js'
import { eventLedger } from '../src/pages/DiscomPage.jsx'

const EPS = 1e-6
const SCN_IDS = Object.keys(SCENARIOS)
const cache = new Map()
const sim = (id = DEFAULT_SCENARIO_ID, seed) => {
  const k = `${id}:${seed}`
  if (!cache.has(k)) cache.set(k, buildSimulation(seed, {}, id))
  return cache.get(k)
}

describe('units and conversions', () => {
  it('uses 96 steps of 0.25 h', () => {
    expect(STEPS).toBe(96)
    expect(DT_H).toBe(0.25)
    expect(sim().withVpp.steps).toHaveLength(96)
  })
  it('DT loading % is kW ÷ (kVA × pf)', () => {
    const d = 0 // 100 kVA
    expect(DT_RATING[d]).toBe(100)
    expect(DT_KW_LIMIT[d]).toBeCloseTo(100 * PF)
    expect(dtLoadPct(100 * PF, d)).toBeCloseTo(100)
    expect(dtLoadPct(-45, d)).toBeCloseTo(-50) // reverse flow is negative
  })
  it('PV scale reproduces the configured daily yield (kWh per kWp per day)', () => {
    for (const id of SCN_IDS) {
      const scn = SCENARIOS[id]
      const h = { kwp: 1, pvNoise: 1, pvScale: pvScaleFor(scn), pvStart: scn.pvStartHr, pvEnd: scn.pvEndHr }
      let kwh = 0
      for (let t = 0; t < 24 * 60; t++) kwh += homePv(h, t / 60) / 60 // 1-minute integration
      expect(kwh).toBeCloseTo(scn.pvYield.value, 1)
    }
  })
  it('fleet matches the topology config', () => {
    const homes = buildFleet()
    expect(homes).toHaveLength(N_HOMES)
    expect(N_DT).toBe(DT_CFG.length)
    homes.forEach((h, i) => expect(h.id).toBe(i + 1)) // index === id − 1
    DT_CFG.forEach((c, dt) => {
      const inDt = homes.filter(h => h.dt === dt)
      expect(inDt).toHaveLength(c.homes)
      expect(inDt.filter(h => h.battery.controllable)).toHaveLength(c.li)
      expect(inDt.filter(h => h.kwp > 0)).toHaveLength(c.solar)
    })
  })
})

describe('reproducibility', () => {
  it('same seed + scenario → identical results', () => {
    const a = buildSimulation(undefined, {}, DEFAULT_SCENARIO_ID)
    const b = buildSimulation(undefined, {}, DEFAULT_SCENARIO_ID)
    expect(a.metrics).toEqual(b.metrics)
    expect(a.events.map(e => e.deliveredKwh)).toEqual(b.events.map(e => e.deliveredKwh))
  })
  it('a different seed changes the fleet', () => {
    expect(buildFleet(1)[0].base).not.toBe(buildFleet(2)[0].base)
  })
  it('rejects an unknown scenario', () => {
    expect(() => buildSimulation(undefined, {}, 'gujarat')).toThrow(/Unknown scenario/)
  })
})

// physical + contractual invariants, checked on every scenario and several seeds
const CASES = [...SCN_IDS.map(id => [id, undefined]), ...[1, 7, 42, 2024].map(s => [DEFAULT_SCENARIO_ID, s])]
describe.each(CASES)('invariants · %s · seed %s', (id, seed) => {
  const s = sim(id, seed)
  const homes = s.homes
  it('battery SoC stays within [reserve floor, BMS max] and energy balances every step', () => {
    for (const run of ['without', 'withVpp']) {
      s[run].steps.forEach((st, t) => homes.forEach((h, i) => {
        const b = h.battery
        const lo = Math.min(b.soc0, Math.max(b.floor, b.reserve))
        expect(st.soc[i]).toBeGreaterThanOrEqual(lo - EPS)
        expect(st.soc[i]).toBeLessThanOrEqual(Math.max(b.soc0, BATTERY.socMax) + EPS)
        expect(st.chg[i]).toBeLessThanOrEqual(b.maxChg + EPS)
        expect(st.dis[i]).toBeLessThanOrEqual(b.maxDis + EPS)
        expect(st.chg[i] > EPS && st.dis[i] > EPS).toBe(false) // never charge and discharge together
        const prev = (t ? s[run].steps[t - 1].soc[i] : b.soc0) * b.cap
        const expected = prev + st.chg[i] * DT_H * b.eff - st.dis[i] * DT_H / b.eff
        expect(Math.abs(expected - st.soc[i] * b.cap)).toBeLessThan(1e-6)
      }))
    }
  })
  it('monitor-only homes are never controlled (no flex, curtailment or VPP dispatch)', () => {
    s.withVpp.steps.forEach(st => homes.forEach((h, i) => {
      if (h.battery.controllable) return
      expect(st.flex[i]).toBe(0)
      expect(st.curtail[i]).toBe(0)
      expect(st.vpp[i]).toBe(0)
    }))
  })
  it('offline homes receive no VPP dispatch while offline', () => {
    s.withVpp.steps.forEach(st => homes.forEach((h, i) => {
      if (isOfflineAt(h.id, st.hr)) expect(st.vpp[i]).toBe(0)
    }))
  })
  it('VPP discharge never makes a home export (no double credit with net metering)', () => {
    expect(CONTROL.noExportDuringDispatch).toBe(true)
    s.withVpp.steps.forEach(st => homes.forEach((h, i) => {
      if (!st.vpp[i]) return
      const net = homeLoad(h, st.hr) + st.flex[i] - (homePv(h, st.hr) - st.curtail[i]) + st.chg[i] - st.dis[i]
      expect(net).toBeGreaterThanOrEqual(-1e-6)
    }))
  })
  it('flexible loads respect the per-home daily limit', () => {
    homes.forEach((h, i) => {
      const hours = s.withVpp.steps.reduce((a, st) => a + (st.flex[i] > 0 ? DT_H : 0), 0)
      expect(hours).toBeLessThanOrEqual(CONTROL.flexMaxH + EPS)
    })
  })
  it('the business-as-usual run has no VPP actions', () => {
    s.without.steps.forEach(st => {
      expect(st.vpp.every(v => v === 0)).toBe(true)
      expect(st.flex.every(v => v === 0)).toBe(true)
      expect(st.curtail.every(v => v === 0)).toBe(true)
    })
  })
  it('event members belong to the event DT, are controllable, and are paid once', () => {
    for (const ev of s.events) {
      const ids = ev.perHome.map(p => p.id)
      expect(new Set(ids).size).toBe(ids.length)
      ev.perHome.forEach(p => {
        const h = homes[p.id - 1]
        expect(h.dt).toBe(ev.dt)
        expect(h.battery.controllable).toBe(true)
        expect(p.deliveredKwh).toBeGreaterThanOrEqual(0)
        expect(p.deliveredKwh).toBeLessThanOrEqual(p.actualKwh + EPS) // verified ≤ measured discharge
      })
      expect(ev.deliveredKwh).toBeCloseTo(ev.perHome.reduce((a, p) => a + p.deliveredKwh, 0), 9)
    }
  })
})

describe('matching rules (evaluateCandidates)', () => {
  const base = { dt: 9, controllable: true, online: true, soc: 0.9, reserve: 0.3, floor: 0.1, cap: 5, eff: 0.95, maxDis: 3, maxChg: 3 }
  it('excludes monitor-only, offline, reserve-protected and low-energy batteries', () => {
    const res = evaluateCandidates([
      { ...base, id: 1, controllable: false },
      { ...base, id: 2, online: false },
      { ...base, id: 3, reserve: 0.85 },
      { ...base, id: 4, soc: 0.35 },
      { ...base, id: 5 },
    ], { kind: 'support', requiredKw: 1, hours: 1 })
    expect(res.rows.map(r => r.verdict)).toEqual(['monitor', 'offline', 'reserve', 'low', 'ok'])
  })
  it('offer = min(inverter kW, usable kWh ÷ hours), usable taken above max(floor, reserve) after losses', () => {
    const res = evaluateCandidates([{ ...base, id: 1 }], { kind: 'support', requiredKw: 1, hours: 2 })
    const usable = (0.9 - 0.3) * 5 * 0.95 // 2.85 kWh
    expect(res.rows[0].usableKwh).toBeCloseTo(usable)
    expect(res.rows[0].offerKw).toBeCloseTo(Math.min(3, usable / 2))
  })
  it('allocates biggest offers first up to request + margin; the rest are standby; reports shortfall', () => {
    const cands = [1, 2, 3, 4].map(id => ({ ...base, id, soc: 0.3 + id * 0.1 }))
    const res = evaluateCandidates(cands, { kind: 'support', requiredKw: 2, hours: 1 })
    const ok = res.rows.filter(r => r.allocKw > 0)
    expect(ok.find(r => r.rank === 1).id).toBe(4) // highest SoC → biggest offer → ranked first
    expect(res.rows.find(r => r.id === 1).verdict).toBe('low')
    expect(res.matchedKw).toBeGreaterThanOrEqual(2)
    expect(res.rows.some(r => r.verdict === 'standby')).toBe(true)
    const short = evaluateCandidates([{ ...base, id: 1 }], { kind: 'support', requiredKw: 10, hours: 1 })
    expect(short.shortfallKw).toBeCloseTo(10 - short.matchedKw)
  })
  it('absorb requests reject full batteries', () => {
    const res = evaluateCandidates([{ ...base, id: 1, soc: 0.97 }, { ...base, id: 2, soc: 0.5 }], { kind: 'absorb', requiredKw: 1, hours: 1 })
    expect(res.rows.map(r => r.verdict)).toEqual(['full', 'ok'])
  })
})

describe('Pune scenarios', () => {
  it('the pre-monsoon story day has a DT event on the hero DT', () => {
    const s = sim()
    expect(s.hero).not.toBeNull()
    expect(s.hero.dt).toBe(HERO_DT)
    expect(dtLoadPct(s.hero.forecastPeakKw, HERO_DT)).toBeGreaterThan(100)
    expect(s.metrics.withVpp.maxDtPct).toBeLessThan(s.metrics.without.maxDtPct) // the VPP helps…
  })
  it('reports a shortfall honestly when enrolled energy is not enough', () => {
    const ev = sim().hero
    // …but with 8 enrolled homes it cannot reach the target: the shortfall must be visible, not hidden
    expect(ev.match.shortfallKw).toBeGreaterThan(0)
    expect(dtLoadPct(ev.peakWithKw, ev.dt)).toBeGreaterThan(CONTROL.eventTarget * 100)
  })
  it('monsoon and winter days have no DT event, so no hero and no settlement (pages must handle null)', () => {
    for (const id of ['pune-monsoon', 'pune-winter']) {
      const s = sim(id)
      expect(s.events).toHaveLength(0)
      expect(s.hero).toBeNull()
      expect(s.settlement).toBeNull()
    }
  })
})

describe('failures, verification and replanning', () => {
  afterEach(() => { DT_CFG[HERO_DT].li = 8; DT_CFG[HERO_DT].li10 = 2 })

  it('home offline at matching time is never selected', () => {
    const row = sim().hero.match.rows.find(r => r.id === SPECIAL.COMMS)
    expect(row.verdict).toBe('offline')
    expect(sim().hero.perHome.find(p => p.id === SPECIAL.COMMS)).toBeUndefined()
  })
  it('a committed home that drops out triggers a replan on the current state', () => {
    const ev = sim().hero
    expect(ev.dropped).toContain(SPECIAL.DROPOUT)
    expect(ev.replans).toHaveLength(1)
    const rp = ev.replans[0]
    const fromHr = FAILURES.offline.find(f => f.id === SPECIAL.DROPOUT).fromHr
    expect(rp.t * DT_H).toBeCloseTo(fromHr)
    expect(rp.droppedIds).toEqual([SPECIAL.DROPOUT])
    expect(rp.hoursLeft).toBeCloseTo((ev.endStep - rp.t) * DT_H)
  })
  it('telemetry gaps count as zero: no delivery is credited after a home drops out', () => {
    const ev = sim().hero
    const p = ev.perHome.find(x => x.id === SPECIAL.DROPOUT)
    expect(p.droppedOut).toBe(true)
    expect(p.gapSteps).toBeGreaterThan(0)
    let act = 0, base = 0
    for (let t = ev.activeStart; t < ev.activeEnd; t++) {
      if (isOfflineAt(p.id, t * DT_H)) continue
      act += sim().withVpp.steps[t].dis[p.id - 1] * DT_H
      base += sim().without.steps[t].dis[p.id - 1] * DT_H
    }
    expect(p.deliveredKwh).toBeCloseTo(Math.max(0, act - base), 9)
  })
  it('partial responders are flagged and paid only for what was measured', () => {
    const p = sim().hero.perHome.find(x => x.id === SPECIAL.PARTIAL)
    expect(p.partial).toBe(true)
  })
  it('with spare enrolled homes, the replan calls them and they then discharge', () => {
    DT_CFG[HERO_DT].li = 18; DT_CFG[HERO_DT].li10 = 5
    const s = buildSimulation(undefined, {}, DEFAULT_SCENARIO_ID)
    const ev = s.hero
    const rp = ev.replans[0]
    expect(rp.added.length).toBeGreaterThan(0)
    for (const a of rp.added) {
      const h = s.homes[a.id - 1]
      expect(h.dt).toBe(ev.dt)
      expect(h.battery.controllable).toBe(true)
      expect(ev.match.rows.find(r => r.id === a.id)?.allocKw ?? 0).toBe(0) // was not committed at 19:00
      const dispatchedAfter = s.withVpp.steps.slice(rp.t).some(st => st.vpp[a.id - 1])
      expect(dispatchedAfter).toBe(true)
      expect(ev.perHome.find(p => p.id === a.id).replanStep).toBe(rp.t)
    }
  })
})

describe('settlement and value', () => {
  it('payment = verified kWh (2 dp) × rate', () => {
    expect(payFor(2.064)).toBeCloseTo(2.06 * RATE_PER_KWH)
    expect(payFor(0)).toBe(0)
  })
  it('the DISCOM ledger lists each controllable home on the event DT exactly once', () => {
    const s = sim()
    const rows = eventLedger(s)
    const ids = rows.map(r => r.home)
    expect(new Set(ids).size).toBe(ids.length)
    const ctrl = s.homes.filter(h => h.dt === s.hero.dt && h.battery.controllable).map(h => h.id).sort((a, b) => a - b)
    expect(ids).toEqual(ctrl)
    rows.filter(r => r.status !== 'verified').forEach(r => expect(r.kwh).toBe(0))
    const total = rows.filter(r => r.status === 'verified').reduce((a, r) => a + payFor(r.kwh), 0)
    expect(total).toBeCloseTo(s.hero.perHome.reduce((a, p) => a + payFor(p.deliveredKwh), 0), 9)
  })
  it('DISCOM value follows the simulated event (no hardcoded kWh)', () => {
    const ev = sim().hero
    const v = discomValue(ev, 8)
    expect(v.pays[0][1]).toBe(Math.round(ev.deliveredKwh * EVENTS_PER_YEAR * RATE_PER_KWH))
    expect(v.net).toBe(v.getsT - v.paysT - v.spendsT)
    expect(discomValue(null, 0).paysT).toBe(0)
  })
})
