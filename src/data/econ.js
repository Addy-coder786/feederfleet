// Settlement economics shown in the demo — researched, see ../../price.md.
// FLOW 1 (exists today): the homeowner's rooftop-solar export credit under MERC net-metering rules (PUNE-R-004),
//   settled by MSEDCL on the bill. Separate. Untouched. (VPP discharge is capped at the home's own
//   load, so no VPP kWh is ever exported and credited twice.)
// FLOW 2 (this project): payment for VERIFIED battery flexibility. India has no market rate for this
//   today, so the rate below is an ILLUSTRATIVE PILOT ASSUMPTION.
// Basis: wear-only breakeven ≈ ₹9.6/verified-kWh (wear accrues on GROSS ~2.7 kWh cycled per event at
// ~₹7.1/kWh, payment is per NET ~2.0 kWh delivered). Researched pilot range: ₹10–14/kWh + a small
// availability retainer covering midday-charging wear. These are battery-cost numbers, not location-specific.
export const RATE_PER_KWH = 12      // ₹ per verified delivered kWh (illustrative pilot rate)
export const RETAINER_YR = 400      // ₹ per home per year availability retainer (assumption)
export const RATE_LABEL = 'illustrative pilot rate'
export const WEAR_FLOOR = 9.6       // ₹/verified-kWh below which the homeowner loses money
export const EVENTS_PER_YEAR = 60   // ASSUMPTION — stressed evenings per year at one DT

// payment is computed on the kWh figure as displayed (2 decimals), so rows always reconcile
export const payFor = kwh => Math.round(kwh * 100) / 100 * RATE_PER_KWH

/**
 * DISCOM value at ONE stressed DT per year, computed from the simulated event (not a fixed number).
 * Sources: price.md §4 + research/final_gaps/1 (DT meter) and /2 (cloud). All ESTIMATES; cloud before 18 % GST.
 * DT augmentation cost is MSEDCL's own cost data (ledger GRID-022): 100 → 200 kVA ≈ ₹4.2 lakh (tender) / ₹5.9 lakh (DPR).
 */
export function discomValue(ev, enrolledHomes) {
  const perEvent = ev ? ev.deliveredKwh : 0 // 🖥 simulated verified kWh at this DT for one event
  const homes = enrolledHomes                // every enrolled home gets a gateway + retainer, dispatched or not
  const kwhYr = perEvent * EVENTS_PER_YEAR
  const v = {
    gets: [
      ['DT-upgrade deferral', 35000, 'ESTIMATE', '₹4.2 lakh MSEDCL tender rate (100 → 200 kVA) × 8.3 % carrying cost'],
      ['Evening energy value', 1200, 'ASSUMPTION', ''],
    ],
    pays: [
      [`Verified kWh × ₹${RATE_PER_KWH}`, Math.round(kwhYr * RATE_PER_KWH), 'ASSUMPTION', `${Math.round(kwhYr)} kWh/yr (🖥 ${perEvent.toFixed(1)} kWh × ${EVENTS_PER_YEAR} events)`],
      [`Retainer ₹${RETAINER_YR} × ${homes} homes`, RETAINER_YR * homes, 'ASSUMPTION', ''],
    ],
    spends: [
      [`Gateways, ${homes} × ₹6,000 over 5 yr`, Math.round(homes * 6000 / 5), 'ESTIMATE', 'parts priced from listings'],
      ['DT meter ₹29,000 over 10 yr', 2900, 'VERIFIED', 'median of 37 RDSS awards (Prayas 2025, national); may already exist'],
      ['Cloud share (lean stack, ~20-home pilot / 3 DTs)', 9500, 'ESTIMATE', 'AWS Mumbai list prices, 2026'],
    ],
    notes: [
      'Positive only where a DT is genuinely approaching an upgrade — the targeted pilot case.',
      'A production-grade cloud (managed DB + standby) for a tiny 20-home pilot costs ≈ ₹1.45 lakh/yr and would wipe this out; it only pays once shared across ~300 homes (≈ ₹1,100/home/yr).',
      'Enrolling a whole feeder (every DT, ~100 homes) loses money today: ≈ −₹1.5 to −₹3 lakh/yr.',
      'Loss reduction (I²R) is real but small at one DT and is not counted (MSEDCL distribution loss FY2023-24: 19.74 %, mostly not DT-peak related; PUNE-R-003).',
      'MERC lets MSEDCL put DT upgrade costs caused by rooftop solar (any size) into its ARR (2024 amendment, PUNE-R-006) — so all consumers pay, and MSEDCL’s own incentive to defer them may be weaker than this table suggests (inference).',
    ],
  }
  const sum = a => a.reduce((x, r) => x + r[1], 0)
  v.getsT = sum(v.gets); v.paysT = sum(v.pays); v.spendsT = sum(v.spends)
  v.net = v.getsT - v.paysT - v.spendsT
  return v
}
