// "Why now" — Maharashtra / MSEDCL. Sources: research/pune/*.md (ledger PUNE-R-*, PUNE-L-*), research/final_gaps/5_why_now.md.
// Pune ledger rows used here passed the independent fact-check of 2026-10-09
// (research/verification/2026-10-09_pune_factcheck.md).
export const WHY_NOW = {
  cards: [
    { k: 'PM Surya Ghar homes (Maharashtra)', then: '6.35 lakh', now: '10.96 lakh', span: '31 Dec 2025 (PIB, households, PUNE-R-016) → 5 Aug 2026 (Lok Sabha, PUNE-L-013). No Wakad-level count is public.',
      src: ['MNRE reply, Lok Sabha Starred Q. 356 (2026)', 'https://sansad.in/getFile/lsapps/loksabhaquestions/annex/188/AS356_3Py51Z.pdf'] },
    { k: 'Li-ion pack price (global avg.)', then: '$156', now: '$108 /kWh', span: '2019 (BNEF, Dec 2019) → 2025; stationary packs $70/kWh in 2025. Different real-dollar bases. Indian retail is still far higher.',
      src: ['BloombergNEF battery price survey 2025', 'https://about.bnef.com/insights/clean-transport/lithium-ion-battery-pack-prices-fall-to-108-per-kilowatt-hour-despite-rising-metal-prices-bloombergnef/'] },
    { k: 'DT meters (Maharashtra, RDSS)', then: '2.52 lakh', now: '3.30 lakh', span: '31 Dec 2025 (PUNE-R-014) → 30 Jun 2026 (PUNE-L-014), of 4.11 lakh sanctioned. Transformer meters — not smart consumer meters. Which Wakad DTs have one is not public.',
      src: ['Ministry of Power, Rajya Sabha Q. 950 (2026)', 'https://www.powermin.gov.in/static/uploads/2026/07/f59419a881df9acc24bed8753f6d9fda.pdf'] },
    { k: 'Demand-flexibility duty (MSEDCL)', then: 'none', now: '1.5 % of peak', span: 'MERC DF & DSM Regulations, Nov 2024 (PUNE-R-012): rises to 3.5 % by FY30; behind-the-meter batteries and aggregators are named.',
      src: ['MERC DF & DSM Regulations 2024', 'https://merc.gov.in/wp-content/uploads/2024/11/DSM-Regulations-English-and-Marathi.pdf'] },
  ],
  changed: 'many more rooftop-solar homes (5,006 MW rooftop solar in the MSEDCL area by Feb 2026, PUNE-R-003); cheaper lithium; DT meters under RDSS; a MERC demand-flexibility obligation that names home batteries and aggregators; MERC draft BESS rules (2026) that would let consumer batteries do demand response; CEA cyber rules and DPDP consent rules now exist.',
  missing: 'no evening peak charge for homes and only a ₹0.85/kWh solar-hours rebate (FY27), so a home battery earns ~nothing from arbitrage; the DFPO is state-wide, not per DT; no MSEDCL residential DR or battery pilot found; no public DT-level data for Wakad–Tathawade; no Indian standard for home-inverter communication; smart-meter data is billing-only.',
}
