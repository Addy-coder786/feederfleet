// 3-month pilot roadmap for Wakad–Tathawade (MSEDCL) — adapted from research/notes/2026-09-27_pilot_roadmap.md
// and research/pune/*.md. Dates are our plan (INFERENCE): events timed for Pune's pre-monsoon heat.
// basis: FACT = source opened · INFERENCE = our reasoning · ESTIMATE = number from price.md
export const RSRC = {
  rdss: { n: 'RDSS guidelines (MoP)', u: 'https://dhbvn.org.in/staticContent/tender/Newscheme/Final_guidelines_RDSS.pdf' },
  dpdp: { n: 'PIB — DPDP Rules 2025', u: 'https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf' },
  certin: { n: 'CERT-In Directions 2022', u: 'https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf' },
  ceacyber: { n: 'CEA Cyber Security Regulations 2026', u: 'https://cea.nic.in/wp-content/uploads/notification/2026/08/Cyber_Regulations_Notification.pdf' },
  msedcl: { n: 'MSEDCL activity rates (DT augmentation)', u: 'https://www.mahadiscom.in/supplier/wp-content/uploads/2024/11/Activity_Rates.pdf' },
  mercdsm: { n: 'MERC DF & DSM Regulations 2024', u: 'https://merc.gov.in/wp-content/uploads/2024/11/DSM-Regulations-English-and-Marathi.pdf' },
  mercbess: { n: 'MERC draft BESS Regulations 2026', u: 'https://merc.gov.in/wp-content/uploads/2026/09/4.-Draft_BESS-Regulations_2026.pdf' },
  rtsdt: { n: 'MERC rooftop RE Regulations 2019 (DT cap, DT-wise data)', u: 'https://merc.gov.in/wp-content/uploads/2022/07/Grid-Interactive-RRE-Regulations2019-English.pdf' },
  ceasafety: { n: 'CEA Safety Regulations 2023 (summary)', u: 'https://ksandk.com/energy/electrical-installations-cea-regulations-2023/' },
}

export const MONTHS = [
  {
    m: 'Month 1', title: 'Prepare', dates: '1 Feb – 28 Feb 2027',
    steps: [
      ['Written go-ahead from MSEDCL (Pimpri division) for a no-tariff-change R&D pilot (MoU / letter)', 'MSEDCL + FeederFleet', 'INFERENCE', null, 'No MERC regulatory sandbox found. 2021 MSEDCL diary lists a Tathwade section under Sangavi sub-division, Pimpri division (PUNE-R-018); Wakad’s office is not listed — confirm.'],
      ['Pick 1–3 stressed DTs in Wakad–Tathawade from DT-meter data (15-min kW / kVA, overload log)', 'MSEDCL shares · FeederFleet analyses', 'FACT', 'rdss', 'RDSS requires communicable DT meters; which Wakad DTs have one is not public.'],
      ['Get DT-wise rooftop-solar capacity (MSEDCL must publish it quarterly) and check the 70 % DT cap', 'FeederFleet', 'FACT', 'rtsdt', 'MERC 2019 Reg 5.2 / 5.3 (PUNE-R-004). The MSEDCL portal needs a login — not yet opened.'],
      ['Map every home / housing society → DT → phase from MSEDCL GIS / consumer indexing; verify on site', 'MSEDCL + installer', 'FACT', 'rdss', 'Mapping accuracy is unknown. Most homes here are large housing societies — a society-level battery may fit better.'],
      ['Hardware survey: inverter brand, battery type, remote-control support. Enrol only confirmed-compatible Li hybrids (target 15–20 homes); others monitor-only', 'FeederFleet', 'INFERENCE', null, 'Several major Indian brands appear to offer monitoring-only apps (low confidence); no public % of controllable homes exists.'],
      ['Check battery rules: MERC draft BESS Regulations 2026 (consumer batteries for self-use, backup and DR) and MSEDCL approval', 'MSEDCL + homeowner', 'FACT', 'mercbess', 'DRAFT only (comments close 12 Oct 2026); final text may change.'],
      ['Plain-language consent: what data, why, withdraw any time', 'FeederFleet + homeowner', 'FACT', 'dpdp', 'DPDP Rules notified Nov 2025, phased compliance.'],
      ['Install gateway + CT sensor via a State-licensed electrical contractor', 'Installer', 'SECONDARY', 'ceasafety', 'Secondary summary of CEA Safety Regulations 2023; clause not verified.'],
      ['Cyber setup: India-hosted cloud, NIC/NPL time sync, 180-day logs, 6-hour incident reporting; design for CEA cyber rules', 'FeederFleet', 'FACT', 'certin', 'CERT-In: 6-hour reporting, 180-day logs (verified). CEA cyber regulations reported to apply from 1 Apr 2027.'],
      ['LV monitor on each pilot DT + 2–3 weeks of baseline data', 'FeederFleet', 'INFERENCE', null, ''],
    ],
  },
  {
    m: 'Month 2', title: 'Pilot', dates: '1 Mar – 31 Mar 2027',
    steps: [
      ['Live telemetry: gateway reads every 1–10 s, cloud replans every 15 min', 'FeederFleet', 'INFERENCE', null, ''],
      ['8–12 controlled evening events (1–2 h) at the pilot DTs only; discharge capped at house load, so net-metering export is untouched', 'FeederFleet · MSEDCL notified', 'INFERENCE', null, 'Keeps approval simple; lowers delivered kWh.'],
      ['Reserve test: owner floor 30–50 % is never crossed; an owner override means “skip”', 'FeederFleet + homeowner', 'INFERENCE', null, ''],
      ['Communication-failure test: cut the internet → gateway falls back to self-use, delivery = 0', 'FeederFleet', 'INFERENCE', null, ''],
      ['Battery-full midday test: paced charging → flexible load → record that exported energy barely changes', 'FeederFleet', 'INFERENCE', null, ''],
      ['Measurement & verification: event − battery-aware baseline, cross-checked with smart-meter 15-min blocks', 'FeederFleet + MSEDCL', 'FACT', 'mercdsm', 'MERC DF & DSM Regulations 2024 use baseline − actual for EM&V (PUNE-R-012); our battery-aware baseline is a design choice.'],
      ['Payment test: pay homeowners directly from the pilot budget (bank / UPI), not on the MSEDCL bill', 'FeederFleet', 'INFERENCE', null, 'An on-bill credit likely needs MERC approval — could not verify.'],
    ],
  },
  {
    m: 'Month 3', title: 'Validate', dates: '1 Apr – 30 Apr 2027',
    steps: [
      ['DT peak kW / kVA with vs without events (matched days)', 'FeederFleet + MSEDCL', 'INFERENCE', null, ''],
      ['Delivery accuracy: gateway kWh vs meter blocks; % of events on target', 'FeederFleet', 'INFERENCE', null, ''],
      ['Homeowner statements and payments; exit survey', 'FeederFleet', 'ESTIMATE', null, '₹12/kWh illustrative pilot rate + retainer.'],
      ['Battery wear: gross kWh cycled × ≈ ₹9.6/kWh vs payment', 'FeederFleet', 'ESTIMATE', null, ''],
      ['Compare with DT augmentation (100 → 200 kVA ≈ ₹4.2–5.9 lakh)', 'FeederFleet + MSEDCL', 'FACT', 'msedcl', 'MSEDCL’s own cost data 2024-25 (GRID-022); unit (₹ lakh) inferred, not printed.'],
      ['Scale decision: propose a DF programme under the MERC DF & DSM Regulations 2024 (counts toward MSEDCL’s DFPO; costs via the ARR) · CEA cyber + DPDP compliance', 'MSEDCL + MERC + FeederFleet', 'FACT', 'mercdsm', 'Route exists on paper (PUNE-R-012). The DFPO is state-wide, not per DT — DT relief is an extra benefit, not what the rule pays for.'],
    ],
  },
]

export const GANTT = [
  ['DISCOM agreement & DT selection', 0, 3],
  ['Home mapping & hardware survey', 1, 4],
  ['Consent & recruitment', 2, 5],
  ['Gateway + DT monitor install', 3, 6],
  ['Baseline data', 4, 7],
  ['Controlled events & failure tests', 5, 9],
  ['M&V + payment test', 6, 10],
  ['Analysis & value case', 9, 12],
  ['Scale / stop decision', 12, 13],
]

export const GATE = [
  ['DT relief', 'Pilot DT stays ≤ 90 % on event evenings (matched-day comparison)'],
  ['Delivery accuracy', '≥ 85 % of committed kWh delivered, confirmed by meter blocks'],
  ['Safety', 'Zero reserve breaches · every comms loss handled as safe self-use'],
  ['Homeowner', 'Payments above battery wear (≈ ₹9.6 per verified kWh)'],
  ['DISCOM', 'Annual cost per stressed DT below the value of deferring its upgrade'],
]

export const BLOCKERS = [
  'No pilot-specific approval route: the first 3 months depend on MSEDCL agreeing; paid scale-up needs MERC approval of a DF programme.',
  'Unknown whether 15–20 compatible Li-hybrid homes sit under one stressed DT.',
  'DT data sharing depends on MSEDCL; no DT-level data for Wakad–Tathawade is public.',
  'Most homes are in large housing societies: per-flat batteries are rare; a society battery needs the society’s consent.',
  'Events are timed for March (pre-monsoon heat); if the MoU slips past February, events fall in the monsoon, when stress and solar are both lower.',
  'MERC BESS and rooftop rules are drafts (2026); final text may change the battery and settlement rules.',
  '3 months is tight — the MoU alone could take longer.',
]
