import { useMemo, useState } from 'react'
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ReferenceArea, ReferenceDot } from 'recharts'
import { DT_RATING } from '../sim/engine.js'
import { fmtHr } from '../sim/model.js'
import { SimBadge, Tag } from '../components/ui.jsx'

const C_WITHOUT = '#b3541e' // validated pair on white
const C_WITH = '#2f8f6b'

const SRC = {
  anand: { name: 'Vekariya et al., "Performance Evaluation of Solar PV Systems in Anand City, Gujarat", Asian J. Current Research 9(2)', year: '2024', url: 'https://exa.ai/library/publication/3txyzc3h6yh' },
  giz: { name: 'GIZ / Energynautics, Analysis of Indian Electricity Distribution Systems for PV Integration', year: '2017', url: 'https://www.bsesdelhi.com/documents/55701/3672243/GIZ_PV_Integration_India_Summary_Report.pdf' },
  loksabha: { name: 'MNRE reply, Lok Sabha Unstarred Q. 1698 (PM Surya Ghar progress)', year: '2026', url: 'https://sansad.in/getFile/lsapps/loksabhaquestions/annex/188/AU1698_2rIKl9.pdf' },
  pib: { name: 'PIB — RDSS smart-meter progress', year: '2025', url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2222217&lang=2&reg=3' },
  press: { name: 'Business Standard, "Gujarat leads rooftop solar race"', year: '2025', url: 'https://www.business-standard.com/india-news/gujarat-rooftop-solar-installations-residential-capacity-clean-energy-125122400772_1.html' },
}

const CALIBRATION = [
  ['High-solar day yield', '4.96 kWh per kWp per day', SRC.anand, 'FINDING', 'best measured month (May) of one 12 kWp Anand system; annual average ≈ 3.5 — our day is a high-solar day'],
  ['Rooftop system size', '3.0–4.6 kWp per solar home', SRC.press, 'ESTIMATE', 'press average ≈ 3.7 kWp'],
  ['Self-consuming batteries miss the midday peak', 'shape of the “without VPP” curve', SRC.giz, 'FINDING', 'simulation study of Delhi and Bhopal feeders (not Gujarat)'],
  ['Evening-peaking residential load', 'AC-driven peak ≈ 20:00–23:00', null, 'ASSUMPTION', 'feeders peaking in the evening/night is reported; hours and AC share are our assumption'],
  ['Fleet mix', '103 of 500 homes VPP-controllable; the rest monitor-only', null, 'ASSUMPTION', 'scenario assumption — no public source gives the real share; a pilot starts with a hardware survey'],
  ['Battery and inverter', '5 kWh / 3 kW (most) and 10 kWh / 5 kW Li-ion; 30 % owner reserve', null, 'ASSUMPTION', 'typical home product sizes'],
  ['Transformers', '100 / 160 kVA, 35–50 homes each', null, 'ASSUMPTION', 'common Indian urban DT sizes'],
]

const EVIDENCE = [
  ['7,66,278', 'rooftop solar installations (11,07,607 households) under PM Surya Ghar in Gujarat, as on 27 Jul 2026. India total: 40,45,298 installations.', SRC.loksabha],
  ['“Usually not”', '“If batteries are optimized for own consumption only, they will usually not reduce the mid-day PV peak.” — research finding from a simulation of Delhi and Bhopal feeders.', SRC.giz],
  ['3.9 crore', 'smart meters installed in India under RDSS by 31 Dec 2025 — the data layer a DT-targeted VPP needs (RDSS only; all schemes ≈ 5.28 crore).', SRC.pib],
]

export default function ImpactPage({ sim }) {
  const [mode, setMode] = useState('feeder')
  const A = sim.metrics.without, B = sim.metrics.withVpp
  const r10 = DT_RATING[9]
  const data = useMemo(() => sim.without.steps.map((s, t) => mode === 'feeder'
    ? { h: s.hr, without: Math.round(s.feederNet), withVpp: Math.round(sim.withVpp.steps[t].feederNet) }
    : { h: s.hr, without: +(100 * s.dtNet[9] / r10).toFixed(1), withVpp: +(100 * sim.withVpp.steps[t].dtNet[9] / r10).toFixed(1) }), [sim, mode, r10])
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
          <p className="text-sm text-dim">Hypothetical Gujarat 11 kV feeder · 500 battery homes · one clear, high-solar day · 15-minute steps</p>
          <p className="mt-1 text-xs font-bold tracking-wide text-[#7a520c]">SIMULATED — NOT MEASURED FROM A LIVE GUJARAT FEEDER</p>
        </div>
        <SimBadge className="ml-auto" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric k="Evening peak" a={`${A.peakKw.toFixed(0)}`} b={`${B.peakKw.toFixed(0)} kW`} d={`↓ ${(100 * (1 - B.peakKw / A.peakKw)).toFixed(1)}%`} />
        <Metric k="Reverse-flow peak (midday)" a={`−${Math.abs(A.reverseKw).toFixed(0)}`} b={`−${Math.abs(B.reverseKw).toFixed(0)} kW`} d={`↓ ${(100 * (1 - B.reverseKw / A.reverseKw)).toFixed(1)}% — exported energy barely changes`} />
        <Metric k={`Worst DT (DT-${A.worstDt + 1})`} a={`${A.maxDtPct.toFixed(0)}%`} b={`${B.maxDtPct.toFixed(0)}%`} d="back under its rating" />
      </div>

      <div className="rounded-lg border border-line bg-white p-4 shadow-card">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h3 className="text-[15px] font-bold">{mode === 'feeder' ? 'Feeder load at the substation — 24 hours (kW)' : 'DT-10 loading — 24 hours (% of 100 kVA rating)'}</h3>
          <div className="ml-auto flex flex-wrap rounded-md border border-line p-0.5 text-xs font-semibold">
            {[['feeder', 'Whole feeder'], ['dt', 'DT-10']].map(([k, l]) => (
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
              <ReferenceArea x1={ev.activeStart / 4} x2={ev.activeEnd / 4} fill="#cfe6d6" fillOpacity={0.5}
                label={{ value: '🌙 VPP dispatch', position: 'insideBottomLeft', fill: '#1f6b45', fontSize: 11 }} />
              <XAxis dataKey="h" type="number" domain={[0, 24]} ticks={[0, 3, 6, 9, 12, 15, 18, 21, 24]} tickFormatter={v => `${v}:00`} stroke="#c9d6ca" tick={{ fill: '#6b7a70', fontSize: 11 }} />
              <YAxis stroke="#c9d6ca" tick={{ fill: '#6b7a70', fontSize: 11 }} tickFormatter={v => `${v}${mode === 'dt' ? '%' : ''}`}
                domain={mode === 'feeder' ? [-500, 1000] : [-60, 120]} ticks={mode === 'feeder' ? [-400, -200, 0, 200, 400, 600, 800, 1000] : [-60, -30, 0, 30, 60, 90, 120]} />
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
          <b className="text-fg">FeederFleet simulation calibrated using real-world solar/load/VPP evidence.</b> Not a measurement of any real Gujarat feeder or VPP.
          Two honest trade-offs are visible: before noon the green line exports <i>more</i> (the VPP keeps battery headroom for the solar peak), and in the early evening it draws more (batteries <i>hold</i> charge for the peak instead of spending it at 18:00).
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-line bg-white p-4 shadow-card">
          <h3 className="mb-2 text-[15px] font-bold">What the simulation is calibrated on</h3>
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
                      {src && ` · ${src.year}`}<div className="text-[10.5px]">{note}</div>
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
          {EVIDENCE.map(([big, text, src]) => (
            <div key={big} className="rounded-lg border border-line bg-white p-3.5 shadow-card">
              <div className="font-mono text-xl font-bold text-grid">{big}</div>
              <p className="mt-0.5 text-sm text-fgb">{text}</p>
              <p className="mt-1.5 text-[11px] text-dim">
                {big.startsWith('“') ? <Tag t="FINDING">Research finding</Tag> : <Tag t="VERIFIED">✅ Verified</Tag>}{' '}
                <a href={src.url} target="_blank" rel="noreferrer" className="underline decoration-grid/30">{src.name}</a> · {src.year}
              </p>
            </div>
          ))}
        </div>
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
