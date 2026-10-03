import { GLOSSARY } from '../data/glossary.js'
import { RATE_PER_KWH, RETAINER_YR, WEAR_FLOOR } from '../data/econ.js'
import { WHY_NOW } from '../data/whynow.js'
import Term from '../components/Term.jsx'
import { SimBadge, Tag } from '../components/ui.jsx'
import { WorkDiagram, LoadCurveLoop } from '../components/OverviewDiagrams.jsx'
import GridCompare from '../components/GridCompare.jsx'

const STEPS = [
  ['TARGET', 'Find the stressed DT', 'DT meters and forecasts show which transformer will overload, and when.'],
  ['PROTECT', 'Respect every reserve', 'Only energy above the owner’s backup reserve and the BMS floor can be used.'],
  ['DISPATCH', 'Ask local batteries only', 'Homes on that DT, in merit order, with staggered ramps — never the whole fleet at once.'],
  ['VERIFY', 'Measure what arrived', 'Actual − baseline per home, cross-checked with the smart meter. Missing data = zero.'],
  ['PAY', 'Pay for verified kWh', `VPP flexibility payment (₹${RATE_PER_KWH}/kWh, illustrative pilot rate). Solar export credit stays separate.`],
]

const TERMS = ['DT', 'SOC', 'RESERVE', 'FLEX', 'HEMS', 'GATEWAY', 'CT', 'FEEDER', 'LT', 'REVERSE', 'MONITOR', 'BASELINE', 'NETMETER', 'KWKWH']

export default function OverviewPage({ sim, go, demo }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      {/* hero */}
      <section className="grid items-center gap-6 rounded-lg border border-line bg-white p-6 shadow-card lg:grid-cols-[1.1fr_1fr] lg:p-8">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-dim">Avartan ’26 · Track 8 · The Feeder as a Power Plant</div>
          <h1 className="mt-2 font-display text-5xl font-extrabold tracking-tight text-fg sm:text-6xl">FEEDERFLEET</h1>
          <p className="mt-3 text-xl font-semibold text-fg">Turn distributed home batteries into feeder flexibility.</p>
          <p className="mt-1 text-base text-fgb">Find the batteries that can safely help the grid — right where the network needs them.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => { go('community'); demo.restart() }} className="rounded-md bg-grid px-5 py-3 text-sm font-bold text-white shadow-card hover:brightness-110">▶ Watch the 60-second demo</button>
            <button onClick={() => go('discom')} className="rounded-md border border-line px-4 py-3 text-sm font-semibold text-fg hover:border-grid/40">DISCOM view</button>
            <button onClick={() => go('home')} className="rounded-md border border-line px-4 py-3 text-sm font-semibold text-fg hover:border-grid/40">Homeowner view</button>
          </div>
          <p className="mt-4 text-xs text-dim">Hypothetical Gujarat 11 kV feeder — simulated. An India/Gujarat-focused integration of proven VPP, DER and demand-response mechanisms — not a new kind of VPP.</p>
        </div>
        <Architecture />
      </section>

      {/* the five steps */}
      <section>
        <h2 className="mb-3 text-lg font-extrabold">How it works</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map(([k, t, d], i) => (
            <div key={k} className="rounded-lg border border-line bg-white p-4 shadow-card">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-grid font-mono text-xs font-bold text-white">{i + 1}</span>
                <span className="text-xs font-bold tracking-[0.14em] text-grid">{k}</span>
              </div>
              <div className="mt-2 text-sm font-bold text-fg">{t}</div>
              <p className="mt-1 text-[13px] leading-snug text-fgb">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* live diagrams: system work diagram + load-curve loop */}
      <section className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <GridCompare sim={sim} />
        <WorkDiagram sim={sim} />
        <LoadCurveLoop sim={sim} />
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-line bg-white p-4 shadow-card">
          <h3 className="text-[15px] font-bold">What makes it different</h3>
          <p className="mt-1 text-sm text-fgb">Each piece exists somewhere in the world. We combine them for Indian feeders:</p>
          <ul className="mt-2 grid gap-1.5 text-sm text-fgb">
            {['DT-targeted dispatch — only where the network is stressed', 'Hard homeowner reserve — a floor the VPP never crosses', 'Mixed devices — controllable Li hybrids plus monitor-only batteries', 'Verified delivery per home — baseline + smart-meter cross-check', 'Pay only for delivery — no verified kWh, no payment'].map(x => (
              <li key={x} className="flex gap-2"><span className="text-grid">✔</span>{x}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-card">
          <h3 className="text-[15px] font-bold">Two separate money flows</h3>
          <div className="mt-2 grid gap-2 text-sm">
            <div className="rounded-md border border-line p-3">
              <div className="font-semibold text-fg">1 · Solar export credit</div>
              <p className="text-fgb">Existing <Term k="NETMETER">net metering</Term> on the DISCOM bill. FeederFleet does not touch it.</p>
            </div>
            <div className="rounded-md border border-grid/30 bg-[#eef6f0] p-3">
              <div className="font-semibold text-fg">2 · VPP flexibility payment</div>
              <p className="text-fgb">For verified battery support when a DT needs it: ₹{RATE_PER_KWH}/verified kWh + ₹{RETAINER_YR}/yr retainer <Tag t="ASSUMPTION">illustrative pilot rate</Tag></p>
            </div>
          </div>
          <p className="mt-2 text-xs text-dim">Electricity always flows through the shared network (home → DT → feeder). No home “sells” power to another home.</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-card">
          <h3 className="text-[15px] font-bold">The homeowner stays in control</h3>
          <ul className="mt-2 grid gap-1.5 text-sm text-fgb">
            <li className="flex gap-2"><span className="text-grid">✔</span>Sets their own backup reserve; raising it means fewer or no requests.</li>
            <li className="flex gap-2"><span className="text-grid">✔</span>Can opt out of any event or leave the programme.</li>
            <li className="flex gap-2"><span className="text-grid">✔</span>If the internet drops, the gateway falls back to normal self-use.</li>
            <li className="flex gap-2"><span className="text-grid">✔</span>Unverifiable delivery is paid as zero — never guessed.</li>
          </ul>
        </div>
      </section>

      <WhyNow />

      {/* technical details, collapsed */}
      <section className="rounded-lg border border-line bg-white shadow-card">
        <details>
          <summary className="cursor-pointer select-none px-4 py-3 text-[15px] font-bold text-fg">Technical details <span className="text-sm font-normal text-dim">— formulas, rules, assumptions, glossary</span></summary>
          <div className="grid gap-4 border-t border-line p-4 lg:grid-cols-2">
            <Detail t="Available flexibility ≠ state of charge">
              <p>usable kWh = capacity × (SoC − max(BMS floor, owner reserve)) × efficiency, and power ≤ the inverter limit.</p>
              <p className="font-mono text-xs">5 kWh × (90 % − 30 %) × 0.95 ≈ 2.9 kWh</p>
            </Detail>
            <Detail t="Matching rules (DT event)">
              <p>Same DT · controllable inverter · online · above reserve · enough energy for the whole event. Offer = min(inverter kW, usable kWh ÷ hours). Local merit order, whole offers, request + 10 % margin; the rest stay on standby.</p>
            </Detail>
            <Detail t="Midday ladder">
              <p>Solar → home use → battery charging (the VPP keeps some headroom for the solar peak) → flexible loads → export limiting only as the last resort. Batteries reduce the reverse-flow <b>peak</b>; they do not remove exported energy.</p>
            </Detail>
            <Detail t="Failure handling">
              <p>Reserve reached → skip. Offline → safe self-use, delivery = 0. Battery full → cannot absorb, next rung of the ladder. Grid outage → normal backup / anti-islanding. Event ends → recharge from the next day’s solar with grid charging held off (design rule; on a cloudy day any grid top-up is staggered to avoid a rebound spike).</p>
            </Detail>
            <Detail t="Settlement">
              <p>delivered kWh = (event discharge − baseline) × time, per home, cross-checked with the smart meter’s 15-min data. The smart meter is a measurement cross-check, not the control path. Battery wear break-even ≈ ₹{WEAR_FLOOR}/verified kWh <Tag t="ESTIMATE" />.</p>
            </Detail>
            <Detail t="Assumptions & limits">
              <p>Hypothetical feeder; 500 battery homes; 103 controllable is a <b>scenario assumption</b> (no public data on the real share). Simulation uses a perfect forecast and one clear day; winter evenings have less stress. Value exists at genuinely stressed DTs, not feeder-wide.</p>
            </Detail>
            <div className="lg:col-span-2">
              <div className="mb-2 text-sm font-bold text-fg">Glossary</div>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {TERMS.map(k => (
                  <div key={k}><dt className="font-semibold text-fg">{GLOSSARY[k].split(' — ')[0]}</dt><dd className="text-fgb">{GLOSSARY[k].split(' — ').slice(1).join(' — ') || GLOSSARY[k]}</dd></div>
                ))}
              </dl>
            </div>
          </div>
        </details>
      </section>
    </div>
  )
}

const Detail = ({ t, children }) => (
  <div className="rounded-md border border-line p-3 text-sm text-fgb"><div className="mb-1 font-bold text-fg">{t}</div><div className="grid gap-1">{children}</div></div>
)

function Architecture() {
  const box = (x, y, w, t, s, fill = '#ffffff', stroke = '#9fb0a4') => (
    <g>
      <rect x={x} y={y} width={w} height="42" rx="6" fill={fill} stroke={stroke} strokeWidth="1.4" />
      <text x={x + w / 2} y={y + 18} textAnchor="middle" fontSize="13" fontWeight="700" fill="#163a28">{t}</text>
      <text x={x + w / 2} y={y + 33} textAnchor="middle" fontSize="10.5" fill="#6b7a70">{s}</text>
    </g>
  )
  const arrow = (x, y1, y2, dashed) => <line x1={x} y1={y1} x2={x} y2={y2} stroke="#51695c" strokeWidth="1.6" strokeDasharray={dashed ? '4 4' : undefined} markerEnd="url(#arr)" />
  return (
    <svg viewBox="0 0 440 400" className="w-full" role="img" aria-label="FeederFleet architecture">
      <defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#51695c" /></marker></defs>
      {box(20, 8, 250, 'DISCOM', 'owns the network · buys flexibility')}
      {arrow(145, 50, 72, true)}
      {box(20, 74, 250, 'Feeder / DT constraints', 'DT loading · forecasts · limits')}
      {arrow(145, 116, 138, true)}
      {box(20, 140, 250, 'FeederFleet VPP cloud', 'forecast · match · dispatch · verify', '#eef6f0', '#1f6b45')}
      {arrow(145, 182, 204, true)}
      {box(20, 206, 250, 'Local gateway (HEMS)', 'safe local rules · fallback if offline')}
      {arrow(145, 248, 270, true)}
      {box(20, 272, 250, 'Hybrid inverter ↔ Battery', 'reserve & BMS limits enforced locally')}
      {box(300, 272, 124, 'Smart meter', 'billing only')}
      <path d="M362,272 L362,165 L276,165" fill="none" stroke="#c98a1b" strokeWidth="1.4" strokeDasharray="3 3" markerEnd="url(#arr)" />
      <text x="370" y="220" fontSize="10.5" fill="#8a5d0f">settlement</text>
      <text x="370" y="233" fontSize="10.5" fill="#8a5d0f">cross-check</text>
      <text x="370" y="246" fontSize="10.5" fill="#8a5d0f">(not control)</text>
      <rect x="20" y="332" width="404" height="56" rx="6" fill="#f7f9f6" stroke="#dde6dd" />
      <text x="34" y="352" fontSize="11" fontWeight="700" fill="#163a28">Power path</text>
      <text x="34" y="370" fontSize="11" fill="#2f4a3b">Home → LT network → DT → 11 kV feeder → substation</text>
      <text x="34" y="382" fontSize="10" fill="#6b7a70">dashed arrows = data / control signals · the VPP never carries power</text>
    </svg>
  )
}

function WhyNow() {
  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-extrabold">Why now — and what is still missing</h2>
        <span className="text-xs text-dim">sourced; national figures are India-wide unless marked Gujarat</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {WHY_NOW.cards.map(c => (
          <div key={c.k} className="rounded-md border border-line p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-dim">{c.k}</div>
            <div className="mt-1 font-mono text-lg font-bold text-fg">{c.then} <span className="text-dim">→</span> <span className="text-grid">{c.now}</span></div>
            <div className="text-[11px] text-dim">{c.span}</div>
            <a href={c.src[1]} target="_blank" rel="noreferrer" className="mt-1 block text-[11px] text-grid underline decoration-grid/30">{c.src[0]}</a>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-md bg-[#eef6f0] p-3 text-sm text-fgb"><b className="text-fg">What changed:</b> {WHY_NOW.changed}</div>
        <div className="rounded-md bg-[#fffaf0] p-3 text-sm text-fgb"><b className="text-fg">Still missing:</b> {WHY_NOW.missing}</div>
      </div>
    </section>
  )
}

export { SimBadge }
