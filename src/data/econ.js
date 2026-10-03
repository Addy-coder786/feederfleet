// Settlement economics shown in the demo — researched, see ../../price.md.
// FLOW 1 (exists today): solar export credit under GERC net metering. Separate. Untouched.
// FLOW 2 (this project): payment for VERIFIED battery flexibility. India has no market
// rate for this today (verified), so the rate below is an ILLUSTRATIVE PILOT ASSUMPTION.
// Basis: wear-only breakeven ≈ ₹9.6/verified-kWh (wear accrues on GROSS ~2.7 kWh cycled
// per event at ~₹7.1/kWh, payment is per NET ~2.0 kWh delivered). Researched pilot
// range: ₹10–14/kWh + a small availability retainer covering midday-charging wear.
export const RATE_PER_KWH = 12      // ₹ per verified delivered kWh (illustrative pilot rate)
export const RETAINER_YR = 400      // ₹ per home per year availability retainer (assumption)
export const RATE_LABEL = 'illustrative pilot rate'
export const WEAR_FLOOR = 9.6       // ₹/verified-kWh below which the homeowner loses money

// payment is computed on the kWh figure as displayed (2 decimals), so rows always reconcile
export const payFor = kwh => Math.round(kwh * 100) / 100 * RATE_PER_KWH

// DISCOM value at ONE stressed DT per year (DT-10: 8 enrolled homes). Sources: price.md §4 +
// research/final_gaps/1 (DT meter) and /2 (cloud). All ESTIMATES; cloud before 18 % GST.
const kwhYr = 8.2 * 60 // 🖥 simulated verified kWh per event × 60 events/yr (ASSUMPTION)
export const DISCOM_VALUE = {
  gets: [
    ['DT-upgrade deferral', 35000, 'ESTIMATE', '₹4.2 lakh upgrade × 8.3 % carrying cost'],
    ['Evening energy value', 1200, 'ASSUMPTION', ''],
  ],
  pays: [
    ['Verified kWh × ₹12', Math.round(kwhYr * 12), 'ASSUMPTION', `${Math.round(kwhYr)} kWh/yr (🖥 8.2 kWh × 60 events)`],
    ['Retainer ₹400 × 8 homes', 3200, 'ASSUMPTION', ''],
  ],
  spends: [
    ['Gateways, 8 × ₹6,000 over 5 yr', 9600, 'ESTIMATE', 'parts priced from listings'],
    ['DT meter ₹29,000 over 10 yr', 2900, 'VERIFIED', 'median of 37 RDSS awards (Prayas 2025); may already exist'],
    ['Cloud share (lean stack, ~20-home pilot / 3 DTs)', 9500, 'ESTIMATE', 'AWS Mumbai list prices, 2026'],
  ],
  notes: [
    'Positive only where a DT is genuinely approaching an upgrade — the targeted pilot case.',
    'A production-grade cloud (managed DB + standby) for a tiny 20-home pilot costs ≈ ₹1.45 lakh/yr and would wipe this out; it only pays once shared across ~300 homes (≈ ₹1,100/home/yr).',
    'Enrolling a whole feeder (every DT, ~100 homes) loses money today: ≈ −₹1.5 to −₹3 lakh/yr.',
    'Loss reduction is small (DGVCL distribution losses ≈ 1.3–4 % depending on year) and is not counted.',
  ],
}
const sum = a => a.reduce((x, r) => x + r[1], 0)
DISCOM_VALUE.getsT = sum(DISCOM_VALUE.gets); DISCOM_VALUE.paysT = sum(DISCOM_VALUE.pays); DISCOM_VALUE.spendsT = sum(DISCOM_VALUE.spends)
DISCOM_VALUE.net = DISCOM_VALUE.getsT - DISCOM_VALUE.paysT - DISCOM_VALUE.spendsT
