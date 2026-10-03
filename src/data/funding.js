// Pilot funding route — research/final_gaps/3_funding_route.md (FR-IN-001…008).
// "DSM" here = Demand Side Management (not the Deviation Settlement Mechanism).
export const FUNDING = {
  tag: 'FACT',
  tagLabel: 'route verified · details partly',
  route: [
    'Pilot: DISCOM / GUVNL own funds or a grant → MoU → homeowners paid directly (bank / UPI), outside the bill — no Gujarat rule found either way (inference)',
    'Pilot results → a DSM programme document filed by the DISCOM → GERC approval before it starts (DSM Regulations 2012)',
    'Paid DSM programme: DISCOM pays homes / vendor → claims actual DSM expenses in its ARR true-up (precedent: Torrent Power Surat, ₹0.08 cr approved)',
    'Future: GERC demand-flexibility regulations (being drafted) + final BESS regulations → paid demand response through aggregators',
  ],
  note: 'Verified: a GERC-approved DSM programme is recoverable through the ARR — DGVCL’s DSM expense line for FY26–30 is currently blank. Not verified: whether homeowner incentives qualify in Gujarat, and procurement rules for an aggregator. No Gujarat rule yet pays homes for battery discharge.',
  sources: [
    ['GERC order, Torrent Power Surat (Case 2427/2024, p.167)', 'https://www.torrentpower.com/public/pdf/regulatory/TPL-D_Surat__MYT_Order_in_Case_No._2427-2024.pdf'],
    ['GERC tariff order, DGVCL FY 2025-26 (mirror copy)', 'https://peak-files.estonetech.in/peak-data-files/Dakshin%20Gujarat%20Vij%20Company%20Limited%20Retail%20Supply%20Tariff%20Order%202025-26.pdf'],
  ],
}
