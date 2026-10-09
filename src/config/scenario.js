/**
 * FeederFleet — simulation scenario configuration.
 * Every number the simulation uses lives here (nothing location-specific is hardcoded in the engine).
 *
 * PROVENANCE: everything below is SYNTHETIC or an ASSUMPTION unless it carries a `src` ledger id
 * (research/sources/*.csv). Nothing here is an MSEDCL measurement.
 *
 * UNITS (kept strictly apart):
 *   kW  = power (a rate)          kWh = energy (an amount)          kVA = apparent power (DT ratings)
 *   h   = hours                   frac = 0–1 fraction (SoC, reserve)  pct = 0–100
 *   One simulation step = 15 min = 0.25 h, so energy (kWh) = power (kW) × 0.25.
 */

export const STEPS = 96   // steps per day
export const DT_H = 0.25  // h per step

// ---------- network topology (SYNTHETIC) ----------
// One row per distribution transformer (DT). kva = nameplate rating (kVA).
// homes = connections, solar = homes with rooftop PV, li = homes with a VPP-controllable lithium battery
// + hybrid inverter (scenario assumption), li10 = of those, 10 kWh / 5 kW units (rest 5 kWh / 3 kW),
// ac = per-home evening AC load range (kW, before the scenario's acScale), acMu/acSig = AC peak hour / spread (h).
// Every other home has a monitor-only battery (lead-acid inverter UPS or closed-API hybrid).
// ASSUMPTION: an independent-house colony (35–50 homes per DT). News examples from Wakad–Tathawade show large
// housing societies (234–900+ flats) with shared common-area rooftop solar (PUNE-L-024, PUNE-L-033); the share of
// societies vs houses is unknown. DT count, kVA and home mix here are NOT MSEDCL data.
export const DT_CFG = [
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
export const HERO_DT = 9 // DT-10 (0-based index): the transformer the demo story follows

// ---------- home devices (ASSUMPTION: typical product sizes) ----------
export const BATTERY = {
  li10: { type: 'li', controllable: true, cap: 10.0, maxChg: 5.0, maxDis: 5.0, eff: 0.95, floor: 0.10, reserve: 0.30 },
  li5:  { type: 'li', controllable: true, cap: 5.0,  maxChg: 3.0, maxDis: 3.0, eff: 0.95, floor: 0.10, reserve: 0.30 },
  pb:   { type: 'pb', controllable: false, cap: 2.4, maxChg: 0.6, maxDis: 0.5, eff: 0.80, floor: 0.50, reserve: 0.50, soc0: 0.55 },
  liSoc0: [0.32, 0.44], // frac — start-of-day SoC range for lithium units
  socMax: 0.98,         // frac — BMS upper limit used for charging
}
export const HOME = {
  kwp: [3.0, 4.6],      // kWp per solar home (ASSUMPTION — independent-house size)
  pvNoise: [0.92, 1.05],
  baseKw: [0.22, 0.32], // kW always-on load
  morningKw: [0.35, 0.65],
  acMu: 21.2, acSig: 2.0, // h — default AC peak hour and spread
}

// ---------- grid / control thresholds (ASSUMPTION) ----------
export const GRID = {
  // Residential evening load (AC, fans, motors) draws reactive power, so kVA > kW.
  // DT loading % = kW ÷ (kVA rating × pf). pf = 1 would understate loading.
  dtPowerFactor: 0.9,         // ASSUMPTION — not measured on any MSEDCL DT
  feederExportCapKw: 330,     // kW export at feeder head before fleet charging kicks in
  feederFlexTripKw: 370,      // kW export: engage enrolled flexible loads
  feederExportHardKw: 395,    // kW export: last-resort export limiting (controllable inverters only)
  dtExportSoft: 0.40,         // frac of DT kW limit: charge local batteries above this export
  dtExportFlex: 0.46,         // frac: add enrolled flexible-load soak above this
  dtExportHard: 0.52,         // frac: export-limit controllable inverters above this
}

export const CONTROL = {
  eventTrip: 1.0,          // frac of DT kW limit — forecast loading that triggers a DT event
  eventTarget: 0.9,        // frac — loading the event holds the DT to
  matchHr: 19.0,           // h — matching / commitment time (after sunset, SoC near its evening max)
  eveningEndHr: 23.25,     // h — end of the evening control window
  rampKwPerStep: 10,       // kW per 15-min step — event ramp limit (no step change on the DT)
  feederRampKwPerStep: 40, // kW per step — feeder-head shaving ramp
  keepFrac: 0.4,           // frac of capacity held back for the feeder peak on non-event DTs
  matchMargin: 0.10,       // extra fraction matched to cover non-delivery
  minOfferKw: 0.8,         // kW — smallest discharge offer worth dispatching
  minAbsorbKw: 0.3,        // kW — smallest charge offer
  noExportDuringDispatch: true, // VPP discharge is capped at the home's own load → no export, so the
                                // net-metering credit and the VPP payment can never pay for the same kWh
  flexKw: 0.3,             // kW per enrolled flexible load (water heater / pump)
  flexMaxH: 2.0,           // h per home per day — flexible-load limit (customer comfort)
  forecastErrorPct: 5,     // ± % — seeded day-level error applied to the planning forecast
  responseDelayMin: 2,     // min — gateway/inverter delay; first active step delivers (15 − delay)/15
}

// ---------- story homes (pinned consumer ids under DT-10; SYNTHETIC) ----------
export const SPECIAL = {
  SETTLED: 137, // settlement example (dispatched)
  RESERVE: 141, // owner keeps 85 % for backup → "reserve protected"
  COMMS: 204,   // comms lost at matching time → safe local fallback, delivery = 0
  FULL: 58,     // battery full at noon → cannot absorb; best helper in the evening
  HELPERS: [17, 41, 229],
  STANDBY: 312, // eligible but not needed at first — called by the replan if a committed home drops out
  DROPOUT: 229, // committed, then loses comms mid-event → triggers a replan
  PARTIAL: 41,  // inverter delivers only part of its setpoint (e.g. thermal derating)
}
export const STORY_OVERRIDES = { reserve: { [SPECIAL.RESERVE]: 0.85 }, soc0: { [SPECIAL.FULL]: 0.93 } }

// ---------- failure model (deterministic, configurable) ----------
export const FAILURES = {
  offline: [
    { id: SPECIAL.COMMS, fromHr: CONTROL.matchHr },  // offline before matching → never selected
    { id: SPECIAL.DROPOUT, fromHr: 21.5 },           // offline after commitment → replan
  ],
  partial: [{ id: SPECIAL.PARTIAL, factor: 0.7 }],   // delivers 70 % of each setpoint
}

// ---------- day scenarios (Wakad–Tathawade, Pune — SYNTHETIC days) ----------
// pvYield = kWh per kWp per day, monthly average from a solar MODEL (not a measurement) at
// lat 18.60, lon 73.76 — an approximate Wakad area centre, not a site (ledger PUNE-L-001, PVGIS-ERA5,
// 15° south tilt, 14 % losses). NSRDB/PVWatts (PUNE-L-003) is given as the high case; no measured
// Pune rooftop yield study was found.
// PV window = sunrise + 0.4 h → sunset − 0.4 h (ASSUMPTION); sunrise/sunset for Pune from PUNE-L-004 (FACT).
// acScale scales the per-home AC load (ASSUMPTION). The load model is a deliberately STRESSED,
// AC-heavy colony: measured Pune homes average ~0.35 kW (0.6 kW with AC) at the May night peak,
// which comes at 12–1 am, later than modelled here (SUR-033).
export const SCENARIOS = {
  'pune-premonsoon': {
    id: 'pune-premonsoon', name: 'Pre-monsoon hot day (May)', dateLabel: '15 May', seed: 20260927,
    pvYield: { value: 4.71, unit: 'kWh/kWp/day', provenance: 'FINDING', note: 'PVGIS model, May average (NSRDB high case 4.77)', src: 'PUNE-L-001' },
    sun: { rise: '06:00', set: '19:01', src: 'PUNE-L-004' },
    pvStartHr: 6.4, pvEndHr: 18.6,
    acScale: 1.0,   // stressed AC-heavy evening (ASSUMPTION)
    story: true,    // the 60-second demo story is written for this scenario
  },
  'pune-monsoon': {
    id: 'pune-monsoon', name: 'Monsoon cloudy day (July)', dateLabel: '15 Jul', seed: 20260927,
    pvYield: { value: 2.32, unit: 'kWh/kWp/day', provenance: 'FINDING', note: 'PVGIS model, July average — low case (NSRDB high case 3.38; the models disagree ~45 %)', src: 'PUNE-L-001' },
    sun: { rise: '06:06', set: '19:14', src: 'PUNE-L-004' },
    pvStartHr: 6.5, pvEndHr: 18.8,
    acScale: 0.45,  // cooler, humid — less AC (ASSUMPTION)
    story: false,
  },
  'pune-winter': {
    id: 'pune-winter', name: 'Winter day (December)', dateLabel: '15 Dec', seed: 20260927,
    pvYield: { value: 4.51, unit: 'kWh/kWp/day', provenance: 'FINDING', note: 'PVGIS model, December average (NSRDB high case 4.29)', src: 'PUNE-L-001' },
    sun: { rise: '06:58', set: '18:00', src: 'PUNE-L-004' },
    pvStartHr: 7.4, pvEndHr: 17.6,
    acScale: 0.2,   // little AC in winter (ASSUMPTION)
    story: false,
  },
}
export const DEFAULT_SCENARIO_ID = 'pune-premonsoon'
