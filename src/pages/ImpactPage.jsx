import { useMemo, useState } from 'react'
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ReferenceArea, ReferenceDot } from 'recharts'
import { buildSimulation, SCENARIOS, HERO_DT, dtLoadPct, PF } from '../sim/engine.js'
import { fmtHr } from '../sim/model.js'
import { SimBadge, Tag } from '../components/ui.jsx'
import { PILOT, FEEDER_LABEL, SIM_DISCLAIMER, DATA_STATUS } from '../config/pilot.js'

const C_WITHOUT = '#b3541e' // validated pair on white
const C_WITH = '#2f8f6b'

// Sources: ledger ids in research/sources/ledger_pune_*.csv and the main ledger.
// Pune rows shown here passed the independent fact-check of 2026-10-09 (research/verification/2026-10-09_pune_factcheck.md).
const SRC = {
  pvgis: { name: 'EU JRC PVGIS v5.2 (ERA5), lat 18.60 lon 73.76 — approx. Wakad area centre, 15° tilt, 14 % loss', year: '2026 (model run)', url: 'https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=18.60&lon=73.76&peakpower=1&loss=14&angle=15&aspect=0&outputformat=json', id: 'PUNE-L-001' },
  sun: { name: 'timeanddate.com — sunrise and sunset, Pune', year: '2026', url: 'https://www.timeanddate.com/sun/india/pune?month=5&year=2026', id: 'PUNE-L-004' },
  prayas: { name: 'Prayas (Energy Group), eMARC — electricity load patterns (Pune homes)', year: '2021', url: 'https://energy.prayaspune.org/our-work/article-and-blog/electricity-load-patterns', id: 'SUR-033' },
  kv: { name: 'Hindustan Times — MSEDCL to establish new substation at Tathawade', year: '2024', url: 'https://www.hindustantimes.com/cities/pune-news/msedcl-to-establish-new-substation-at-tathawade-101707754771789.html', id: 'PUNE-L-007' },
  society: { name: 'Times of India — solar projects in Wakad housing societies', year: '2025', url: 'https://timesofindia.indiatimes.com/city/pune/solar-projects-a-ray-of-hope-to-curb-electricity-budgets/articleshow/121960870.cms', id: 'PUNE-L-024' },
  giz: { name: 'GIZ / Energynautics, Analysis of Indian Electricity Distribution Systems for PV Integration', year: '2017', url: 'https://www.bsesdelhi.com/documents/55701/3672243/GIZ_PV_Integration_India_Summary_Report.pdf', id: null },
  tariff: { name: 'MERC tariff order, MSEDCL, Case 75 of 2025 (25 Mar 2026)', year: '2026', url: 'https://www.mahadiscom.in/wp-content/uploads/2026/07/Tariff-Order_Case-No.-75-of-2025-dated-25th-March-2026.pdf', id: 'PUNE-R-003' },
  dtMeters: { name: 'Ministry of Power, Rajya Sabha Unstarred Q. 950 — RDSS smart metering, annexure', year: '2026', url: 'https://www.powermin.gov.in/static/uploads/2026/07/f59419a881df9acc24bed8753f6d9fda.pdf', id: 'PUNE-L-014' },
}

const CALIBRATION = [
  ['Solar yield (May demo day)', '4.71 kWh per kWp per day', SRC.pvgis, 'FINDING', 'solar MODEL output, not a measurement; July 2.32, December 4.51; NSRDB gives a higher monsoon case'],
  ['Sunrise / sunset', '15 May 06:00 / 19:01 → PV from ~06:24 to ~18:36', SRC.sun, 'FACT', 'PV window = sunrise + 0.4 h to sunset − 0.4 h (our assumption)'],
  ['Feeder voltage', `${PILOT.kv} (substations ${PILOT.substation})`, SRC.kv, 'SECONDARY', 'news quoting MSEDCL; labels only — the simulation has no voltage model'],
  ['Evening-peaking residential load', 'AC-driven peak ≈ 20:00–23:00, 1.8–2.9 kW per home', SRC.prayas, 'ASSUMPTION', 'deliberately STRESSED: measured Pune homes average ~0.35 kW (0.6 kW with AC) at the May night peak, which comes at 12–1 am'],
  ['DT loading', `% = kW ÷ (kVA × pf ${PF})`, null, 'ASSUMPTION', 'power factor assumed, not measured on any MSEDCL DT'],
  ['Self-consuming batteries miss the midday peak', 'shape of the “without VPP” curve', SRC.giz, 'FINDING', 'simulation study of Delhi and Bhopal feeders (not Pune)'],
  ['Neighbourhood type', 'independent-house colony, 35–50 homes per DT', SRC.society, 'ASSUMPTION', 'news examples from Wakad–Tathawade are large housing societies whose shared solar runs common areas; the real mix is unknown'],
  ['Fleet mix', '103 of 500 homes VPP-controllable; the rest monitor-only', null, 'ASSUMPTION', 'no public source gives the real share; a pilot starts with a hardware survey'],
  ['Battery and inverter', '5 kWh / 3 kW (most) and 10 kWh / 5 kW Li-ion; 30 % owner reserve', null, 'ASSUMPTION', 'typical home product sizes'],
  ['Rooftop system size', '3.0–4.6 kWp per solar home', null, 'ASSUMPTION', 'independent-house size; society systems are shared (~0.3–0.4 kW per flat)'],
]

const EVIDENCE = [
  ['5,006 MW', 'rooftop solar installed in the MSEDCL area, all categories (Feb 2026). No Wakad- or DT-level figure is public.', SRC.tariff, 'FACT'],
  ['“Usually not”', '“If batteries are optimized for own consumption only, they will usually not reduce the mid-day PV peak.” — research finding from a simulation of Delhi and Bhopal feeders.', SRC.giz, 'FINDING'],
  ['3,30,254', 'DT meters installed in Maharashtra under RDSS by 30 Jun 2026 (of 4,10,905 sanctioned). These are transformer meters — not smart consumer meters — and “installed” does not mean “sending data”. Which Wakad DTs have one is not public.', SRC.dtMeters, 'FACT'],
]

export default function ImpactPage({ sim, overrides }) {
  const [mode, setMode] = useState('feeder')
  const A = sim.metrics.without, B = sim.metrics.withVpp
  const dt = HERO_DT
  const data = useMemo(() => sim.without.steps.map((s, t) => mode === 'feeder'
    ? { h: s.hr, without: Math.round(s.feederNet), withVpp: Math.round(sim.withVpp.steps[t].feederNet) }
    : { h: s.hr, without: +dtLoadPct(s.dtNet[dt], dt).toFixed(1), withVpp: +dtLoadPct(sim.withVpp.steps[t].dtNet[dt], dt).toFixed(1) }), [sim, mode, dt])
  const pkA = data.reduce((b, p) => (p.without > b.without ? p : b))
  const pkB = data.filter(p => p.h > 17).reduce((b, p) => (p.withVpp > b.withVpp ? p : b))
  const rvA = data.reduce((b, p) => (p.without < b.without ? p : b))
  const rvB = data.reduce((b, p) => (p.withVpp < b.withVpp ? p : b))
  const unit = mode === 'feeder' ? 'kW' : '%'
  const ev = sim.hero

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-2xl font-extrabold">Impact · without VPP vs with FeederFleet</h2>
          <p className="text-sm text-dim">{FEEDER_LABEL} · 500 homes · {sim.scenario.name} (synthetic day) · 15-minute steps</p>
          <p className="mt-1 text-xs font-bold tracking-wide text-[#7a520c]">{SIM_DISCLAIMER}</p>
        </div>
        <SimBadge className="ml-auto" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric k="Evening peak" a={`${A.peakKw.toFixed(0)}`} b={`${B.peakKw.toFixed(0)} kW`} d={`↓ ${(100 * (1 - B.peakKw / A.peakKw)).toFixed(1)}%`} />
        <Metric k="Reverse-flow peak (midday)" a={`−${Math.abs(A.reverseKw).toFixed(0)}`} b={`−${Math.abs(B.reverseKw).toFixed(0)} kW`} d={`↓ ${(100 * (1 - B.reverseKw / A.reverseKw)).toFixed(1)}% · exported ${A.exportedKwh.toFixed(0)} → ${B.exportedKwh.toFixed(0)} kWh`} />
        <Metric k={`Worst DT (DT-${A.worstDt + 1})`} a={`${A.maxDtPct.toFixed(0)}%`} b={`${B.maxDtPct.toFixed(0)}%`} d={B.maxDtPct <= 100.5 ? 'back under its rating (% of kVA)' : 'still above its kVA rating — shortfall flagged'} />
      </div>

      <div className="rounded-lg border border-line bg-white p-4 shadow-card">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h3 className="text-[15px] font-bold">{mode === 'feeder' ? 'Feeder load at the substation — 24 hours (kW)' : `DT-${dt + 1} loading — 24 hours (% of ${sim.dtRating[dt]} kVA rating, pf ${PF})`}</h3>
          <div className="ml-auto flex flex-wrap rounded-md border border-line p-0.5 text-xs font-semibold">
            {[['feeder', 'Whole feeder'], ['dt', `DT-${dt + 1}`]].map(([k, l]) => (
              <button key={k} onClick={() => setMode(k)} className={`rounded px-2.5 py-1 ${mode === k ? 'bg-grid text-white' : 'text-fgb hover:bg-panel2'}`}>{l}</button>
            ))}
          </div>
        </div>
        <p className="mb-1 text-[11px] text-dim">Below 0 = power flowing back towards the substation (reverse flow).</p>
        <div className="h-[440px]">
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 24, right: 20, bottom: 0, left: -4 }}>
              <CartesianGrid stroke="#e7ede7" strokeDasharray="2 4" vertical={false} />
              <ReferenceArea x1={10.5} x2={15.5} fill="#f3dfae" fillOpacity={0.3}
                label={{ value: '☀️ Solar peak — batteries charge, surplus still flows back', position: 'insideTop', fill: '#8a5d0f', fontSize: 11 }} />
              {ev && ev.activeHours > 0 && <ReferenceArea x1={ev.activeStart / 4} x2={ev.activeEnd / 4} fill="#cfe6d6" fillOpacity={0.5}
                label={{ value: '🌙 VPP dispatch', position: 'insideBottomLeft', fill: '#1f6b45', fontSize: 11 }} />}
              <XAxis dataKey="h" type="number" domain={[0, 24]} ticks={[0, 3, 6, 9, 12, 15, 18, 21, 24]} tickFormatter={v => `${v}:00`} stroke="#c9d6ca" tick={{ fill: '#6b7a70', fontSize: 11 }} />
              <YAxis stroke="#c9d6ca" tick={{ fill: '#6b7a70', fontSize: 11 }} tickFormatter={v => `${v}${mode === 'dt' ? '%' : ''}`}
                domain={mode === 'feeder' ? [-500, 1000] : [-90, 130]} ticks={mode === 'feeder' ? [-400, -200, 0, 200, 400, 600, 800, 1000] : [-90, -60, -30, 0, 30, 60, 90, 120]} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #dde6dd', borderRadius: 6, fontSize: 12 }} formatter={(v, n) => [`${v} ${unit}`, n]} labelFormatter={fmtHr} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#9fb3a4" />
              {mode === 'dt' && <ReferenceLine y={100} stroke="#c0452f" strokeDasharray="4 3" label={{ value: 'rating 100%', position: 'insideTopLeft', fill: '#c0452f', fontSize: 11 }} />}
              <Area name="Without VPP (batteries self-use only)" dataKey="without" stroke={C_WITHOUT} strokeWidth={2} fill={C_WITHOUT} fillOpacity={0.06} isAnimationActive={false} />
              <Line name="With FeederFleet" dataKey="withVpp" stroke={C_WITH} strokeWidth={3} dot={false} isAnimationActive={false} />
              <ReferenceDot x={pkA.h} y={pkA.without} r={4} fill={C_WITHOUT} stroke="#fff" label={{ value: `${pkA.without}${unit === '%' ? '%' : ' kW'}`, position: 'top', fill: C_WITHOUT, fontSize: 12, fontWeight: 700 }} />
              <ReferenceDot x={pkB.h} y={pkB.withVpp} r={4} fill={C_WITH} stroke="#fff" label={{ value: `${pkB.withVpp}${unit === '%' ? '%' : ' kW'}`, position: 'bottom', fill: C_WITH, fontSize: 12, fontWeight: 700 }} />
              <ReferenceDot x={rvA.h} y={rvA.without} r={4} fill={C_WITHOUT} stroke="#fff" label={{ value: `${rvA.without}${unit === '%' ? '%' : ' kW'}`, position: 'bottom', fill: C_WITHOUT, fontSize: 12, fontWeight: 700 }} />
              <ReferenceDot x={rvB.h + 0.6} y={rvB.withVpp} r={0} label={{ value: `${rvB.withVpp}${unit === '%' ? '%' : ' kW'}`, position: 'right', fill: C_WITH, fontSize: 12, fontWeight: 700 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-sm text-fgb">
          <b className="text-fg">Synthetic simulation, partly calibrated with public Pune solar and load evidence (table below).</b> Not a measurement of any {PILOT.utility.short} feeder, DT or VPP. The event is planned from a forecast with a ±5 % seeded error; the feeder-head cap is found with hindsight (an optimistic bound).
          Two honest trade-offs are visible: before noon the green line exports <i>more</i> (the VPP keeps battery headroom for the solar peak), and in the early evening it draws more (batteries <i>hold</i> charge for the peak instead of spending it at 18:00).
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-line bg-white p-4 shadow-card">
          <h3 className="mb-2 text-[15px] font-bold">What the simulation is calibrated on — and what is assumed</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead className="text-left text-[10.5px] uppercase tracking-wider text-dim">
                <tr className="border-b border-line"><th className="py-1.5 font-semibold">Model input</th><th className="font-semibold">Value used</th><th className="font-semibold">Source · year</th><th className="font-semibold">Status</th></tr>
              </thead>
              <tbody>
                {CALIBRATION.map(([k, v, src, st, note]) => (
                  <tr key={k} className="border-b border-line/60 align-top">
                    <td className="py-2 pr-3 font-semibold text-fg">{k}</td>
                    <td className="pr-3 font-mono text-fgb">{v}</td>
                    <td className="pr-3 text-dim">
                      {src ? <a href={src.url} target="_blank" rel="noreferrer" className="text-grid underline decoration-grid/30">{src.name}</a> : '—'}
                      {src && ` · ${src.year}`}{src?.id && <span className="font-mono"> · {src.id}</span>}<div className="text-[10.5px]">{note}</div>
                    </td>
                    <td><Tag t={st} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="grid gap-3">
          <h3 className="text-[15px] font-bold">Why this matters · sourced facts</h3>
          {EVIDENCE.map(([big, text, src, tag]) => (
            <div key={big} className="rounded-lg border border-line bg-white p-3.5 shadow-card">
              <div className="font-mono text-xl font-bold text-grid">{big}</div>
              <p className="mt-0.5 text-sm text-fgb">{text}</p>
              <p className="mt-1.5 text-[11px] text-dim">
                {tag === 'FINDING' ? <Tag t="FINDING">Research finding</Tag> : <Tag t="FACT">Source opened · fact-checked</Tag>}{' '}
                <a href={src.url} target="_blank" rel="noreferrer" className="underline decoration-grid/30">{src.name}</a> · {src.year}{src.id && <span className="font-mono"> · {src.id}</span>}
              </p>
            </div>
          ))}
        </div>
      </div>

      <SeasonCompare overrides={overrides} current={sim.scenario.id} />
      <DataStatus />
    </div>
  )
}

/** The same synthetic feeder on three Pune days. Each row is a full simulation run. */
function SeasonCompare({ overrides, current }) {
  const rows = useMemo(() => Object.values(SCENARIOS).map(scn => {
    const s = buildSimulation(undefined, overrides, scn.id)
    const A = s.metrics.without, B = s.metrics.withVpp
    return {
      scn, A, B, events: s.events, flex: s.flexKwh, curt: s.curtailedKwh,
      short: s.events.reduce((a, e) => a + e.match.shortfallKw, 0),
      kwh: s.events.reduce((a, e) => a + e.deliveredKwh, 0),
    }
  }), [overrides])
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-bold">Same feeder, three Pune days</h3><SimBadge className="ml-auto" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs tabular-nums">
          <thead className="text-left text-[10.5px] uppercase tracking-wider text-dim">
            <tr className="border-b border-line">
              <th className="py-1.5 font-semibold">Synthetic day</th><th className="font-semibold">Solar yield</th>
              <th className="text-right font-semibold">Evening peak (kW)</th><th className="text-right font-semibold">Reverse flow (kW)</th>
              <th className="text-right font-semibold">Worst DT (% of kVA)</th><th className="text-right font-semibold">DT events</th>
              <th className="text-right font-semibold">Shortfall (kW)</th><th className="text-right font-semibold">Verified (kWh)</th>
              <th className="text-right font-semibold">Flex / curtailed (kWh)</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map(({ scn, A, B, events, short, kwh, flex, curt }) => (
              <tr key={scn.id} className={`border-b border-line/60 ${scn.id === current ? 'bg-[#f3f9f4]' : ''}`}>
                <td className="py-2 pr-3 font-sans font-semibold text-fg">{scn.name}</td>
                <td className="pr-3 font-sans text-fgb">{scn.pvYield.value} {scn.pvYield.unit} <Tag t={scn.pvYield.provenance} /></td>
                <td className="pr-3 text-right">{A.peakKw.toFixed(0)} → {B.peakKw.toFixed(0)}</td>
                <td className="pr-3 text-right">{A.reverseKw.toFixed(0)} → {B.reverseKw.toFixed(0)}</td>
                <td className="pr-3 text-right">{A.maxDtPct.toFixed(0)} → {B.maxDtPct.toFixed(0)}</td>
                <td className="pr-3 text-right">{events.length}</td>
                <td className="pr-3 text-right">{events.length ? short.toFixed(1) : '—'}</td>
                <td className="pr-3 text-right">{events.length ? kwh.toFixed(1) : '—'}</td>
                <td className="text-right">{flex.toFixed(0)} / {curt.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-dim">Reverse flow = most negative feeder value (more negative = more power flowing back). AC load on the monsoon and winter days is scaled down by assumption. With these assumptions only the hot pre-monsoon evening overloads a DT; winter has the largest midday reverse flow. Flexible loads and curtailment are used only at enrolled homes.</p>
    </div>
  )
}

/** What local data exists for the pilot area — and what does not. */
function DataStatus() {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <h3 className="text-[15px] font-bold">Local data status · {PILOT.short}</h3>
      <p className="mb-2 text-xs text-dim">Every number in this demo is synthetic or an assumption unless a row below says otherwise. {PILOT.utility.short}: {PILOT.utility.relation.toLowerCase()}.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="text-left text-[10.5px] uppercase tracking-wider text-dim">
            <tr className="border-b border-line"><th className="py-1.5 font-semibold">Dataset</th><th className="font-semibold">Status</th><th className="font-semibold">What public sources give</th><th className="font-semibold">What the demo uses</th><th className="font-semibold">How to get it</th></tr>
          </thead>
          <tbody>
            {DATA_STATUS.map(r => (
              <tr key={r.k} className="border-b border-line/60 align-top">
                <td className="py-2 pr-3 font-semibold text-fg">{r.k}</td>
                <td className="pr-3"><Tag t={r.status} /></td>
                <td className="pr-3 text-fgb">{r.found}</td>
                <td className="pr-3 text-fgb">{r.demo}</td>
                <td className="text-dim">{r.how}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const Metric = ({ k, a, b, d }) => (
  <div className="rounded-lg border border-line bg-white p-4 shadow-card">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-dim">{k}</span>
      <SimBadge />
    </div>
    <div className="mt-1 font-mono"><span className="text-base text-dim line-through">{a}</span> <span className="text-dim">→</span> <span className="text-3xl font-bold text-grid">{b}</span></div>
    <div className="text-xs font-semibold text-grid">{d}</div>
  </div>
)
