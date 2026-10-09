export const SimBadge = ({ className = '' }) => <span className={`sim-badge ${className}`}>🖥 Simulated</span>

export const TAG = {
  VERIFIED: 'bg-[#e6f2ea] text-grid border-grid/25',
  ESTIMATE: 'bg-[#fbf1dc] text-[#7a520c] border-solar/30',
  ASSUMPTION: 'bg-panel2 text-dim border-line',
  SIMULATED: 'bg-[#fbf1dc] text-[#7a520c] border-solar/30',
  INFERENCE: 'bg-panel2 text-dim border-line',
  FINDING: 'bg-[#eef3f8] text-[#2f4a5b] border-[#c9d6e0]',
  SECONDARY: 'bg-[#fbf1dc] text-[#7a520c] border-solar/30',
  FACT: 'bg-[#e6f2ea] text-grid border-grid/25',
  SYNTHETIC: 'bg-[#fbf1dc] text-[#7a520c] border-solar/30',
  PROXY: 'bg-[#fdf0e6] text-[#8a4a12] border-[#e7c3a0]',
  UNVERIFIED: 'bg-[#fbe9e5] text-[#9b3322] border-[#e6aa9d]',
  MISSING: 'bg-[#fbe9e5] text-[#9b3322] border-[#e6aa9d]',
}
const TAG_LABEL = { FINDING: 'Research finding', SECONDARY: 'Secondary source', PROXY: 'Proxy (other place)', MISSING: 'Not available' }
export const Tag = ({ t, children }) => <span className={`badge border ${TAG[t] || TAG.ASSUMPTION}`}>{children || TAG_LABEL[t] || t}</span>

export const Status = ({ tone = 'green', children }) => {
  const m = { green: 'bg-[#e6f2ea] text-grid', amber: 'bg-[#fbf1dc] text-[#7a520c]', red: 'bg-[#fbe9e5] text-[#9b3322]', grey: 'bg-panel2 text-dim' }
  const d = { green: '#2f8f6b', amber: '#c98a1b', red: '#c0452f', grey: '#9aa59d' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold ${m[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: d[tone] }} />{children}
    </span>
  )
}

export const PanelTitle = ({ kicker, title, right }) => (
  <div className="mb-3 flex flex-wrap items-end gap-x-3 gap-y-1">
    <div>
      {kicker && <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-dim">{kicker}</div>}
      <h3 className="text-[15px] font-bold leading-tight">{title}</h3>
    </div>
    {right && <div className="ml-auto">{right}</div>}
  </div>
)

export const Kpi = ({ label, value, unit, sub, tone }) => (
  <div className="min-w-0">
    <div className="text-[11px] font-medium uppercase tracking-wider text-dim">{label}</div>
    <div className={`mt-0.5 font-mono text-xl font-semibold tabular-nums ${tone === 'amber' ? 'text-[#9a5f0a]' : tone === 'red' ? 'text-alert' : 'text-fg'}`}>
      {value}{unit && <span className="ml-1 text-sm font-normal text-dim">{unit}</span>}
    </div>
    {sub && <div className="text-[11px] text-dim">{sub}</div>}
  </div>
)
