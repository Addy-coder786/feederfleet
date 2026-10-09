/**
 * Pilot location + stakeholder configuration. Change the pilot area here, not across the UI.
 *
 * Wakad–Tathawade is the PROPOSED pilot area. FeederFleet has no agreement, data-sharing or control
 * authorisation from MSEDCL. Feeder, DT and home data in the demo are SYNTHETIC.
 */
export const PILOT = {
  area: 'Wakad–Tathawade',
  city: 'Pimpri-Chinchwad, Pune',
  state: 'Maharashtra',
  country: 'India',
  short: 'Wakad–Tathawade, Pune',
  utility: {
    short: 'MSEDCL',
    name: 'Maharashtra State Electricity Distribution Company Limited',
    relation: 'Proposed utility stakeholder — no engagement, data access or authorisation yet',
  },
  regulator: { short: 'MERC', name: 'Maharashtra Electricity Regulatory Commission' },
  // Wakad–Tathawade is mostly supplied at 22 kV from 220/22 kV substations (news quoting MSEDCL, ledger PUNE-L-007;
  // fact-checked). Some 22/11 kV substations exist nearby (2021 MSEDCL diary, PUNE-R-018), so not 22 kV only.
  // The Track 8 brief says 11 kV; the simulation has no voltage model, so only labels change.
  kv: '22 kV', substation: '220/22 kV', kvSrc: 'PUNE-L-007',
  feeder: 'Synthetic 22 kV feeder',
  brief: 'Avartan ’26 · Track 8 “The Feeder as a Power Plant”',
  briefNote: 'The Track 8 brief describes Gujarat feeders; this team proposes Wakad–Tathawade, Pune as its pilot area.',
}

/** One-line label used in headers: what the demo is and where it is set. */
export const FEEDER_LABEL = `${PILOT.feeder} · proposed pilot area ${PILOT.short}`
export const SIM_DISCLAIMER = `SIMULATED — NOT MEASURED ON ANY MSEDCL FEEDER`

/**
 * Local data status for Wakad–Tathawade. One row per dataset the pilot needs.
 * status: VERIFIED (official source in the ledger) · PROXY (other place / wider area) ·
 *         SYNTHETIC (demo data) · MISSING (not found publicly) · UNVERIFIED
 * Filled from research/pune/*.md (ledger: research/sources/ledger_pune_*.csv).
 */
export const DATA_STATUS = [
  { k: 'Rooftop-solar connections and capacity (kW) in Wakad–Tathawade', status: 'MISSING',
    found: 'Only wider areas: Pimpri-Chinchwad 2,383 projects / 50.40 MW, all categories (Jun 2023, news, PUNE-L-009); Maharashtra PM Surya Ghar 10.96 lakh homes / 2,608 MW (to 5 Aug 2026, Lok Sabha, PUNE-L-013). Nothing per DT.',
    demo: 'SYNTHETIC — 257 of 500 homes, 3.0–4.6 kWp each',
    how: 'MSEDCL “Feeder/DTC information” portal (needs a guest login, PUNE-L-020); MERC 2019 rooftop rules require MSEDCL to publish DT-wise data quarterly (PUNE-L-019); RTI to MSEDCL Pimpri division' },
  { k: 'DT inventory (kVA) and which DTs have verified remote monitoring', status: 'MISSING',
    found: 'State level only: Maharashtra DT meters under RDSS 3,30,254 installed of 4,10,905 sanctioned (30 Jun 2026, PUNE-L-014). These are DT meters — not the same as smart consumer meters — and “installed” does not mean “sending data”.',
    demo: 'SYNTHETIC — 12 DTs of 100 / 160 kVA',
    how: 'RTI: DT list (code, kVA, location, DT meter yes/no) for the Wakad and Tathawade sub-divisions; MoU with MSEDCL' },
  { k: 'DT-wise load (15-min kW / kVA, timestamped)', status: 'MISSING',
    found: 'None public.',
    demo: 'SYNTHETIC load model (stressed, AC-heavy)',
    how: 'Data-sharing MoU for RDSS DT-meter data; RTI for quarterly DT peak loads' },
  { k: 'Solar generation and export', status: 'PROXY',
    found: 'Model only: PVGIS 4.71 kWh/kWp/day in May, 2.32 in July (PUNE-L-001); NSRDB high case (PUNE-L-003). No measured Pune rooftop study found.',
    demo: 'Synthetic PV shape scaled to the PVGIS monthly yield',
    how: 'Society inverter portals and net-meter export data, with consent' },
  { k: 'Home batteries (kWh, kW, SoC, consent, constraints)', status: 'MISSING',
    found: 'None for Pune. A 2020 state survey found under 5 % of Maharashtra homes had inverters (R2-IN-015).',
    demo: 'SYNTHETIC — 103 controllable Li units, 30 % owner reserve',
    how: 'Opt-in household / housing-society survey + written consent for any control' },
  { k: 'Flexible loads (kW, duration, eligibility)', status: 'MISSING',
    found: 'Load shape only: Pune homes ~0.35 kW average at the May night peak (12–1 am), ~0.6 kW in AC homes (Prayas, 42 homes, SUR-033).',
    demo: 'ASSUMPTION — 0.3 kW, max 2 h/day, enrolled homes only',
    how: 'Survey of homes and society loads (pumps, lifts) + consent' },
  { k: 'MERC / MSEDCL rules, tariffs, data access', status: 'VERIFIED',
    found: 'Net metering, credit carried forward monthly (PUNE-R-004). Rooftop solar on one DT capped at 70 % of its rating (PUNE-R-004). Residential time-of-day: ₹0.85/kWh rebate for 09–17 h use in FY27, no evening peak charge (PUNE-R-003). MERC DF & DSM Regulations 2024: MSEDCL must hold demand flexibility of 1.5 % of peak; home batteries and aggregators named (PUNE-R-012). Draft BESS and rooftop rules 2026 open for comment until 12 Oct 2026 (PUNE-R-009/010/011). Primary sources opened and fact-checked (2026-10-09).',
    demo: 'Settlement uses an illustrative ₹12/kWh pilot rate, outside the tariff',
    how: 'Comment on the 2026 drafts; ask MSEDCL how a DT-level pilot can count toward its DFPO; data-sharing terms under DPDP consent' },
  { k: 'Building type of the pilot area', status: 'PROXY',
    found: 'News examples show large housing societies (234, 433 and 900+ flats) whose shared rooftop solar (~0.3–0.4 kW per flat) runs common areas such as lifts and pumps, not the flats (PUNE-L-024, PUNE-L-033). An MSEDCL chief engineer says one DT can serve 500+ consumers — a general remark, not Wakad DT data (PUNE-L-022). How many homes are societies vs houses is not known.',
    demo: 'ASSUMPTION — independent-house colony, 35–50 homes per DT',
    how: 'Site survey; a society-level battery may fit better than per-flat batteries' },
]
