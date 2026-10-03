// "Why now" — research/final_gaps/5_why_now.md (sources opened unless noted).
export const WHY_NOW = {
  cards: [
    { k: 'Gujarat solar homes', then: '~2 lakh', now: '11.08 lakh', span: 'Dec 2020 (news, SURYA-Gujarat) → Jul 2026 (PM Surya Ghar households). Different schemes — ratio is rough.',
      src: ['MNRE reply, Lok Sabha AU1698 (2026)', 'https://sansad.in/getFile/lsapps/loksabhaquestions/annex/188/AU1698_2rIKl9.pdf'] },
    { k: 'Li-ion pack price (global avg.)', then: '$156', now: '$108 /kWh', span: '2019 (BNEF, Dec 2019) → 2025; stationary packs $70/kWh in 2025. Different real-dollar bases. Indian retail is still far higher.',
      src: ['BloombergNEF battery price survey 2025', 'https://about.bnef.com/insights/clean-transport/lithium-ion-battery-pack-prices-fall-to-108-per-kilowatt-hour-despite-rising-metal-prices-bloombergnef/'] },
    { k: 'Smart meters (India)', then: '37 lakh', now: '3.9 crore', span: 'Feb 2022 (news report of a Lok Sabha reply) → 31 Dec 2025 under RDSS (approved Jun 2021).',
      src: ['PIB, RDSS progress (Dec 2025)', 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2222217&lang=2&reg=3'] },
    { k: 'DT metering', then: 'rare', now: 'required', span: 'RDSS (2021) requires communicable DT meters and DT-level energy accounting. We could not confirm a current Gujarat count.',
      src: ['RDSS guidelines (MoP)', 'https://dhbvn.org.in/staticContent/tender/Newscheme/Final_guidelines_RDSS.pdf'] },
  ],
  changed: 'many more solar homes and stressed DTs; cheaper lithium; some hybrid inverter brands now accept remote commands; DT meters and consumer→DT mapping from RDSS; the words “aggregator” and consumer-level aggregation appear in GERC’s draft BESS regulations (2026); CEA cyber rules and DPDP consent rules now exist.',
  missing: 'no residential evening peak charge in Gujarat and net metering removes the arbitrage; no DR programme or flexibility payment for homes yet (GERC demand-flexibility rules are only being drafted); no public count of controllable batteries (in 2020 most home batteries were lead-acid UPS units); no Indian standard for home-inverter communication; smart-meter data is billing-only.',
}
