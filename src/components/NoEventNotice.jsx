import { dtLoadPct, SCENARIOS, DEFAULT_SCENARIO_ID } from '../sim/engine.js'
import { SimBadge } from './ui.jsx'

/** Empty state: the chosen synthetic day has no DT forecast to overload, so there is no event to tell. */
export default function NoEventNotice({ sim, go, onDefault }) {
  const A = sim.metrics.without, B = sim.metrics.withVpp
  return (
    <div className="mx-auto mt-6 max-w-2xl rounded-lg border border-line bg-white p-6 shadow-card" role="status">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-extrabold">No transformer event on this day</h2>
        <SimBadge className="ml-auto" />
      </div>
      <p className="mt-2 text-sm text-fgb">
        On the <b>{sim.scenario.name}</b> scenario no DT is forecast above 100 % of its kVA rating, so FeederFleet sends no
        evening request. The worst DT peaks at <b>{A.maxDtPct.toFixed(0)} %</b> (DT-{A.worstDt + 1}). Batteries stay in normal self-use.
      </p>
      <ul className="mt-3 grid gap-1 font-mono text-sm text-fgb">
        <li>Feeder evening peak: {A.peakKw.toFixed(0)} → {B.peakKw.toFixed(0)} kW</li>
        <li>Reverse flow (most negative): {A.reverseKw.toFixed(0)} → {B.reverseKw.toFixed(0)} kW</li>
        <li>Worst DT reverse flow: {A.maxDtRevPct.toFixed(0)} % → {B.maxDtRevPct.toFixed(0)} % of rating</li>
      </ul>
      <p className="mt-3 text-xs text-dim">The step-by-step story (matching, dispatch, settlement) is written for the {SCENARIOS[DEFAULT_SCENARIO_ID].name} scenario.
        DT loading uses an assumed power factor of {sim.pf} (kW ÷ (kVA × pf)); peak DT loading here = {dtLoadPct(Math.max(...sim.without.steps.map(s => s.dtNet[A.worstDt])), A.worstDt).toFixed(0)} %.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onDefault} className="rounded-md bg-grid px-4 py-2 text-sm font-bold text-white hover:brightness-110">Switch to {SCENARIOS[DEFAULT_SCENARIO_ID].name}</button>
        <button onClick={() => go('impact')} className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-fg hover:bg-panel2">Compare all days on Impact</button>
      </div>
    </div>
  )
}
