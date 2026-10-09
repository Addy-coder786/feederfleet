// Hardware ↔ software connection (feasibility) — the team's connection diagram plus what our research says
// about each link. Sources: price.md §2, research/technical/2026-09-26_modules_B_D_K-device.md,
// research/technical/2026-09-26_r2_Q1_Q2_devices_data.md, research/final_gaps/1 (DT meter), ledger ids below.
import diagram from '../assets/hardware-software-link.jpg'
import { Tag, SimBadge } from './ui.jsx'
import { PILOT } from '../config/pilot.js'

const PATHS = [
  {
    k: '1 · Home',
    flow: 'Hybrid inverter / HEMS → Modbus (RS-485) → gateway → 4G → FeederFleet VPP cloud',
    what: 'The gateway reads solar, load, battery SoC and sends charge / discharge setpoints. HEMS = home energy management system; Modbus RS-485 = a common 2-wire industrial data link on hybrid inverters.',
    facts: [
      ['FACT', 'Sungrow and GoodWe expose a Modbus command register for the export limit; GoodWe’s Modbus TCP is often not enabled by default.'],
      ['FACT', 'Remote control is not uniform, even within one brand’s installed base — a hardware survey must confirm each home.'],
      ['ESTIMATE', 'Local gateway (Modbus converter + enclosure + labour): ₹5,500–7,000 per home.'],
    ],
  },
  {
    k: '2 · Transformer (DT)',
    flow: 'DT → DT-FD sensor (loading + power-flow direction) + split-core CT sensor → 4G → FeederFleet VPP cloud',
    what: 'Measures how loaded the DT is and whether power flows forward or backward. CT = current transformer, a clip-on current sensor; “split-core” opens, so no wire is cut.',
    facts: [
      ['FACT', 'DT meter ≈ ₹29,000 per DT all-in for ~10 years — median of 37 RDSS awards (Prayas 2025, FG1-001).'],
      ['FACT', 'Maharashtra already has 3,30,254 RDSS DT meters installed (Jun 2026, PUNE-L-014) — MSEDCL may own one on the pilot DT. “Installed” does not mean “sending data”.'],
      ['FACT', 'Split-core CT 800/5 A listed at ₹3,200 in Pune (PR-HW-006) — sized for a DT, too big for a home.'],
    ],
  },
  {
    k: '3 · Fallback',
    flow: 'No Modbus gateway or DT sensor? → 4G IoT communication kit (ESP32 board + 4G modem + CT input) → FeederFleet VPP cloud',
    what: 'ESP32 = a low-cost Wi-Fi microcontroller board. With a 4G modem it can read a CT and report over the mobile network.',
    facts: [
      ['INFERENCE', 'Good for a prototype and read-only monitoring. Field use needs an enclosure, a licensed electrician, and the CEA cyber-security and DPDP consent rules.'],
      ['INFERENCE', 'Not priced in our research yet — needs quotes before the pilot budget.'],
    ],
  },
]

const CHECKS = [
  ['Read-only monitoring (homes + DT)', 'Feasible with parts on sale today', 'ESTIMATE'],
  ['Remote battery control', 'Depends on inverter brand, firmware and installer settings — survey first', 'FACT'],
  ['Comms loss', 'Gateway falls back to normal self-use; delivery counted as zero (as in the simulation)', 'INFERENCE'],
  ['Safety and power path', 'The VPP only sends data. Power always flows home → LT network → DT; nothing is rewired', 'INFERENCE'],
  ['Cyber + consent', 'CERT-In 6-hour reporting and 180-day logs; DPDP consent before any data or control', 'FACT'],
]

export default function HardwareLink() {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-dim">Feasibility</div>
          <h2 className="text-lg font-extrabold">Hardware ↔ software connection</h2>
        </div>
        <span className="ml-auto flex flex-wrap items-center gap-1.5"><Tag t="SYNTHETIC">No hardware connected in this demo</Tag><SimBadge /></span>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <figure>
          <img src={diagram} width="1233" height="864" loading="lazy"
            alt="Connection diagram: inverter HEMS to Modbus gateway, and distribution transformer to DT-FD and CT sensors, both over 4G to the FeederFleet VPP cloud; fallback 4G IoT communication kit"
            className="h-auto w-full rounded-md border border-line" />
          <figcaption className="mt-1.5 text-[11px] text-dim">
            Team BIT FLARE diagram. Product photos are representative — not a chosen brand, supplier or purchase.
          </figcaption>
        </figure>

        <div className="grid gap-3">
          {PATHS.map(p => (
            <div key={p.k} className="rounded-md border border-line p-3">
              <div className="text-sm font-bold text-fg">{p.k}</div>
              <div className="mt-0.5 font-mono text-[11.5px] leading-snug text-grid">{p.flow}</div>
              <p className="mt-1 text-xs text-fgb">{p.what}</p>
              <ul className="mt-1.5 grid gap-1">
                {p.facts.map(([t, txt]) => (
                  <li key={txt} className="flex gap-1.5 text-[11.5px] leading-snug text-fgb"><span className="shrink-0"><Tag t={t} /></span><span>{txt}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-xs">
          <thead className="text-left text-[10.5px] uppercase tracking-wider text-dim">
            <tr className="border-b border-line"><th className="py-1.5 font-semibold">Feasibility check</th><th className="font-semibold">Answer</th><th className="font-semibold">Basis</th></tr>
          </thead>
          <tbody>
            {CHECKS.map(([k, v, t]) => (
              <tr key={k} className="border-b border-line/60 align-top">
                <td className="py-1.5 pr-3 font-semibold text-fg">{k}</td>
                <td className="pr-3 text-fgb">{v}</td>
                <td><Tag t={t} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-dim">
        For a {PILOT.short} pilot, the first step is a hardware survey of enrolled homes / housing societies, and asking {PILOT.utility.short} whether the pilot DT already has an RDSS DT meter that can share 15-min data.
      </p>
    </section>
  )
}
