// Pilot funding route — research/pune/2026-10-09_merc_msedcl_rules.md (ledger PUNE-R-*).
// "DSM" = Demand Side Management. "DF" = Demand Flexibility. "DFPO" = Demand Flexibility Portfolio Obligation.
// Pune ledger rows used here passed the independent fact-check of 2026-10-09
// (research/verification/2026-10-09_pune_factcheck.md).
export const FUNDING = {
  tag: 'FACT',
  tagLabel: 'route exists on paper · details partly verified',
  route: [
    'Pilot: an MSEDCL-approved R&D pilot (MoU / letter) or a grant → homeowners paid directly (bank / UPI), outside the bill — no rule found either way (inference)',
    'MERC DF & DSM Regulations 2024 oblige MSEDCL to hold demand flexibility of 1.5 % of last year’s peak (FY26–27), rising to 3.5 % by FY30; behind-the-meter batteries and aggregators are named (PUNE-R-012)',
    'MERC has told MSEDCL to file a demand-flexibility plan and to run a battery pilot at distribution-substation level (MYT order, PUNE-R-002) — a natural home for a DT-level pilot (inference)',
    'Approved DF / DSM programme costs are recovered through MSEDCL’s ARR; MERC sets ±₹0.20 crore per MW incentive / penalty around the DFPO target (PUNE-R-012)',
    'Future: MERC draft BESS Regulations 2026 would let a “Lead ESS” aggregate consumer batteries for demand response — DRAFT, minimum 1 MW / 2 h to connect (PUNE-R-010)',
  ],
  note: 'Verified (source opened): the DFPO and the named role for behind-the-meter batteries and aggregators. Complication: the DFPO is counted state-wide, not per DT, and Maharashtra’s peak can fall in solar hours (farm pumping) — so a state DR event may not match a DT’s evening peak. No MSEDCL residential DR or battery pilot was found. DT upgrades are paid through all consumers’ tariffs, so MSEDCL’s own incentive to defer them is weak (inference).',
  sources: [
    ['MERC DF & DSM Regulations 2024 (PUNE-R-012)', 'https://merc.gov.in/wp-content/uploads/2024/11/DSM-Regulations-English-and-Marathi.pdf'],
    ['MERC MYT order, MSEDCL, Case 217 of 2024 (PUNE-R-002)', 'https://merc.gov.in/wp-content/uploads/2025/03/MSEDCL-MYT-Order_Case_no_217-of-2024.pdf'],
    ['MERC draft BESS Regulations 2026 (PUNE-R-010)', 'https://merc.gov.in/wp-content/uploads/2026/09/4.-Draft_BESS-Regulations_2026.pdf'],
  ],
}
