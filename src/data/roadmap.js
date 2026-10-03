// 3-month pilot roadmap — from research/notes/2026-09-27_pilot_roadmap.md (+ final_gaps/3_funding_route.md).
// basis: FACT = source opened · INFERENCE = our reasoning · ESTIMATE = number from price.md
export const RSRC = {
  rdss: { n: 'RDSS guidelines (MoP)', u: 'https://dhbvn.org.in/staticContent/tender/Newscheme/Final_guidelines_RDSS.pdf' },
  dpdp: { n: 'PIB — DPDP Rules 2025', u: 'https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf' },
  certin: { n: 'CERT-In Directions 2022', u: 'https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf' },
  ceacyber: { n: 'CEA Cyber Security Regulations 2026', u: 'https://cea.nic.in/wp-content/uploads/notification/2026/08/Cyber_Regulations_Notification.pdf' },
  msedcl: { n: 'MSEDCL activity rates (DT augmentation)', u: 'https://www.mahadiscom.in/supplier/wp-content/uploads/2024/11/Activity_Rates.pdf' },
  ceasafety: { n: 'CEA Safety Regulations 2023 (summary)', u: 'https://ksandk.com/energy/electrical-installations-cea-regulations-2023/' },
}

export const MONTHS = [
  {
    m: 'Month 1', title: 'Prepare', dates: '27 Sep – 27 Oct 2026',
    steps: [
      ['Written go-ahead from one DISCOM circle for a no-tariff-change R&D pilot (MoU / letter)', 'DISCOM + FeederFleet', 'INFERENCE', null, 'No GERC regulatory sandbox found.'],
      ['Pick 1–3 stressed DTs from DT-meter and energy-accounting data (15-min kW, overload log)', 'DISCOM shares · FeederFleet analyses', 'FACT', 'rdss', 'RDSS requires communicable DT meters and DT-level energy accounting.'],
      ['Map every home → DT → phase from DISCOM GIS / consumer indexing; verify on site', 'DISCOM + installer', 'FACT', 'rdss', 'Mapping accuracy is unknown — checked on site.'],
      ['Hardware survey: inverter brand, battery type, remote-control support. Enrol only confirmed-compatible Li hybrids (target 15–20 homes); others monitor-only', 'FeederFleet', 'INFERENCE', null, 'Several major Indian brands appear to offer monitoring-only apps (low confidence); no public % of controllable homes exists.'],
      ['Check battery paperwork: GEDA registration (reported for the draft GERC BESS rules) and DISCOM approval', 'DISCOM + homeowner', 'SECONDARY', null, 'Reported in trade press; draft status — final notification not confirmed.'],
      ['Plain-language consent: what data, why, withdraw any time', 'FeederFleet + homeowner', 'FACT', 'dpdp', 'DPDP Rules notified Nov 2025, phased compliance.'],
      ['Install gateway + CT sensor via a State-licensed electrical contractor', 'Installer', 'SECONDARY', 'ceasafety', 'Secondary summary of CEA Safety Regulations 2023; clause not verified.'],
      ['Cyber setup: India-hosted cloud, NIC/NPL time sync, 180-day logs, 6-hour incident reporting; design for CEA cyber rules', 'FeederFleet', 'FACT', 'certin', 'CERT-In: 6-hour reporting, 180-day logs (verified). CEA cyber regulations reported to apply from 1 Apr 2027.'],
      ['LV monitor on each pilot DT + 2–3 weeks of baseline data', 'FeederFleet', 'INFERENCE', null, ''],
    ],
  },
  {
    m: 'Month 2', title: 'Pilot', dates: '28 Oct – 27 Nov 2026',
    steps: [
      ['Live telemetry: gateway reads every 1–10 s, cloud replans every 15 min', 'FeederFleet', 'INFERENCE', null, ''],
      ['8–12 controlled evening events (1–2 h) at the pilot DTs only; discharge capped at house load, so net-metering export is untouched', 'FeederFleet · DISCOM notified', 'INFERENCE', null, 'Keeps approval simple; lowers delivered kWh.'],
      ['Reserve test: owner floor 30–50 % is never crossed; an owner override means “skip”', 'FeederFleet + homeowner', 'INFERENCE', null, ''],
      ['Communication-failure test: cut the internet → gateway falls back to self-use, delivery = 0', 'FeederFleet', 'INFERENCE', null, ''],
      ['Battery-full midday test: paced charging → flexible load → record that exported energy barely changes', 'FeederFleet', 'INFERENCE', null, ''],
      ['Measurement & verification: event − battery-aware baseline, cross-checked with smart-meter 15-min blocks', 'FeederFleet + DISCOM', 'INFERENCE', null, 'Our design. Indian DR programmes (e.g. TPDDL) reportedly use consumption baselines.'],
      ['Payment test: pay homeowners directly from the pilot budget (bank / UPI), not on the DISCOM bill', 'FeederFleet', 'INFERENCE', null, 'An on-bill credit likely needs GERC approval — could not verify.'],
    ],
  },
  {
    m: 'Month 3', title: 'Validate', dates: '28 Nov – 27 Dec 2026',
    steps: [
      ['DT peak kW with vs without events (matched days)', 'FeederFleet + DISCOM', 'INFERENCE', null, ''],
      ['Delivery accuracy: gateway kWh vs meter blocks; % of events on target', 'FeederFleet', 'INFERENCE', null, ''],
      ['Homeowner statements and payments; exit survey', 'FeederFleet', 'ESTIMATE', null, '₹12/kWh illustrative pilot rate + retainer.'],
      ['Battery wear: gross kWh cycled × ≈ ₹9.6/kWh vs payment', 'FeederFleet', 'ESTIMATE', null, ''],
      ['Compare with DT augmentation (100 → 200 kVA ≈ ₹4.2–5.9 lakh)', 'FeederFleet + DISCOM', 'FACT', 'msedcl', 'Maharashtra cost data — not Gujarat.'],
      ['Scale decision: file a DSM programme with GERC (cost recovered through the ARR) · DISCOM capex plan · CEA cyber + DPDP compliance', 'DISCOM + GERC + FeederFleet', 'FACT', null, 'DSM route verified (GERC DSM Regulations 2012; see funding route). Approval needed before paying through the tariff.'],
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
  'No pilot-specific approval route: the first 3 months depend on one DISCOM agreeing; paid scale-up needs GERC DSM approval.',
  'Unknown whether 15–20 compatible Li-hybrid homes sit under one stressed DT.',
  'DT data sharing depends on the DISCOM; there is no public mechanism.',
  'Oct–Dec is winter: evening AC stress is lower, so the pilot mainly proves control and settlement, not big peak cuts.',
  'BESS rules: draft vs notified status unclear.',
  '3 months is tight — the MoU alone could take longer.',
]
