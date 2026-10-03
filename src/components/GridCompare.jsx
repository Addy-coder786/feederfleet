// "General power grid vs our VPP solution" — animated, hoverable version of the hand-drawn comparison.
// Moving dots = electric power. Top: one direction only. Bottom: the local network carries power both ways.
import { useRef, useState } from 'react'
import { HERO_DT } from '../sim/engine.js'
import { SimBadge } from './ui.jsx'

const TIPS = {
  plant: ['Generation · power plant', 'Large thermal / central plants make electricity far from the homes that use it.'],
  stepup: ['Step-up transformer', 'Raises the voltage (e.g. to 220–400 kV) so power can travel long distances with low losses.'],
  tower: ['Transmission tower', 'High-voltage lines carry bulk power from the plant to grid substations.'],
  dt: ['Substation + distribution transformer (DT)', 'The substation steps down to 11 kV (the feeder). The street DT then steps down to 415 V for homes. Each DT has a rating (e.g. 100 kVA).'],
  dtStress: ['DT overload — “load occurs” here', 'In the evening, AC load from all homes on one DT adds up. Above 100 % of rating the DT overheats and ages faster; the usual fix is a costly upgrade.'],
  dtVpp: ['DT kept below its limit', 'FeederFleet asks only the batteries under this DT to discharge at the peak, so the DT stays near its 90 % target instead of overloading.'],
  pole: ['LT pole & service line', 'Low-tension (415 / 230 V) street network. Each home connects through its own service line — no house-to-house cables.'],
  home: ['Consumer home', 'Only takes power from the grid. Its load adds to the DT’s evening peak.'],
  prosumer: ['Prosumer home', 'Rooftop solar + home battery + hybrid inverter. It can make, store and (when the DT needs it) send power to the local network.'],
  solar: ['Rooftop solar', 'Makes power at midday. Surplus first charges the battery; the rest flows back to the local network.'],
  battery: ['Home battery', 'Charges from solar at midday. In a DT event it discharges — but never below the owner’s backup reserve.'],
  uni: ['Unidirectional', 'Power flows one way: plant → transmission → distribution → homes. Every kW of the evening peak must come down the whole chain.'],
  bi: ['Bidirectional (local network)', 'Power can flow both ways between homes and the DT: midday solar flows back; evening battery power serves nearby homes on the same DT, so less comes from upstream.'],
}

export default function GridCompare({ sim }) {
  const box = useRef(null)
  const [tip, setTip] = useState(null)
  const rating = sim.dtRating[HERO_DT]
  const pkWithout = Math.round(100 * sim.hero.peakWithoutKw / rating)
  const pkWith = Math.round(100 * sim.hero.peakWithKw / rating)
  const show = k => e => {
    const r = box.current.getBoundingClientRect()
    setTip({ k, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width })
  }
  const hide = () => setTip(null)
  const hp = k => ({ onMouseMove: show(k), onMouseLeave: hide, onClick: show(k), className: 'gc-hit', style: { cursor: 'help' } })

  return (
    <div ref={box} className="relative rounded-lg border border-line bg-white p-4 shadow-card">
      <style>{`
        .gc-hit { transition: filter .2s; }
        .gc-hit:hover { filter: drop-shadow(0 0 4px rgba(31,107,69,.55)); }
        @keyframes gc-smoke { 0% { transform: translate(0,0) scale(.6); opacity: .0 } 20% { opacity: .75 } 100% { transform: translate(14px,-34px) scale(1.5); opacity: 0 } }
        .gc-smoke { animation: gc-smoke 3.2s linear infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes gc-pulse { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
        .gc-pulse { animation: gc-pulse 1.4s ease-in-out infinite; }
      `}</style>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-bold">From a one-way grid to a two-way local network</h3>
        <SimBadge />
        <span className="ml-auto text-[11px] text-dim">Hover or tap any part · moving dots = electric power</span>
      </div>
      <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <Panel kind="grid" hp={hp} pk={pkWithout} />
        <div className="flex items-center justify-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dfe7fb] text-lg font-bold text-[#3b5bab] xl:rotate-0 rotate-90">➜</span>
        </div>
        <Panel kind="vpp" hp={hp} pk={pkWith} />
      </div>
      <p className="mt-2 text-[11px] text-dim">Illustration — not to scale. DT-10 peak figures are from the simulated hypothetical feeder ({pkWithout} % → {pkWith} % of its 100 kVA rating).</p>

      {tip && (
        <div className="pointer-events-none absolute z-20 w-64 rounded-md border border-line bg-white p-2.5 text-xs shadow-lg"
          style={{ left: Math.min(tip.x + 14, tip.w - 270), top: tip.y + 14 }}>
          <div className="font-bold text-fg">{TIPS[tip.k][0]}</div>
          <div className="mt-0.5 leading-snug text-fgb">{TIPS[tip.k][1]}</div>
        </div>
      )}
    </div>
  )
}

/* ─────────────── one panel ─────────────── */

function Panel({ kind, hp, pk }) {
  const vpp = kind === 'vpp'
  const id = kind
  const HOUSES = [74, 142, 210]
  const MAIN = 'M126,150 C150,150 160,150 178,150 C215,150 240,74 300,70 C360,74 385,150 418,150'
  const branch = y => `M440,150 C455,150 462,${y} 482,${y} L548,${y}`
  const panelBg = vpp ? '#f2f8f1' : '#fdfaee'
  const flowC = vpp ? '#3b5bab' : '#d0453a'

  return (
    <div className="rounded-lg border-2 border-dashed p-2" style={{ background: panelBg, borderColor: vpp ? '#9fcbad' : '#e2c98d' }}>
      <div className="mb-1 flex justify-center">
        <span className="rounded-md border-2 border-[#3b4a8f] bg-[#eef0fb] px-3 py-0.5 text-sm font-extrabold text-[#1f2a5c]">{vpp ? 'Our VPP solution' : 'General power grid'}</span>
      </div>
      <svg viewBox="0 0 640 330" className="w-full" role="img" aria-label={vpp ? 'Grid with VPP prosumers' : 'Conventional grid'}>
        <defs>
          <path id={`${id}-main`} d={MAIN} />
          {HOUSES.map((y, k) => <path key={k} id={`${id}-b${k}`} d={branch(y)} />)}
          <marker id={`${id}-ah`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={flowC} /></marker>
        </defs>

        {/* stage labels */}
        {[['Generation', 70, '#fbe3e6', '#e3a3ad'], ['Transmission', 300, '#e6e9fb', '#a9b2e6'], ['Distribution', 500, '#e3f3e6', '#9fcbad']].map(([t, x, f, s]) => (
          <g key={t}>
            <rect x={x - 56} y="6" width="112" height="24" rx="6" fill={f} stroke={s} />
            <text x={x} y="23" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1f2a5c">{t}</text>
          </g>
        ))}

        {/* wires */}
        <use href={`#${id}-main`} fill="none" stroke="#3a4354" strokeWidth="1.6" />
        {HOUSES.map((y, k) => <use key={k} href={`#${id}-b${k}`} fill="none" stroke="#3a4354" strokeWidth="1.4" />)}

        {/* power particles */}
        {[0, 0.6, 1.2, 1.8].map(b => (
          <circle key={`m${b}`} r="3.6" fill={vpp ? '#c98a1b' : '#d0453a'}>
            <animateMotion dur="2.4s" begin={`${b}s`} repeatCount="indefinite"><mpath href={`#${id}-main`} /></animateMotion>
          </circle>
        ))}
        {HOUSES.map((y, k) => [0, 0.8].map(b => (
          <circle key={`f${k}${b}`} r="3.2" fill={vpp ? '#c98a1b' : '#d0453a'}>
            <animateMotion dur="1.6s" begin={`${b + k * 0.25}s`} repeatCount="indefinite"><mpath href={`#${id}-b${k}`} /></animateMotion>
          </circle>
        )))}
        {vpp && HOUSES.map((y, k) => [0.4, 1.2].map(b => (
          <circle key={`r${k}${b}`} r="3.4" fill="#2f8f6b" stroke="#fff" strokeWidth="1">
            <animateMotion dur="1.6s" begin={`${b + k * 0.3}s`} repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear"><mpath href={`#${id}-b${k}`} /></animateMotion>
          </circle>
        )))}

        {/* power plant */}
        <g {...hp('plant')}>
          <rect x="8" y="40" width="130" height="150" fill="transparent" />
          {[[36, 0], [40, 1.6], [80, 0.8], [84, 2.4]].map(([x, d], k) => (
            <circle key={k} className="gc-smoke" cx={x} cy={k < 2 ? 88 : 106} r="8" fill="#9aa1a8" style={{ animationDelay: `${d}s` }} />
          ))}
          <path d="M18,180 C26,150 26,120 20,96 L56,96 C50,120 50,150 58,180 Z" fill="#b9bfc5" stroke="#3a4354" strokeWidth="1.2" />
          <path d="M66,180 C72,158 72,134 68,114 L94,114 C90,134 90,158 96,180 Z" fill="#c7ccd1" stroke="#3a4354" strokeWidth="1.2" />
          <path d="M96,180 V156 A20,20 0 0 1 136,156 V180 Z" fill="#d5d9dd" stroke="#3a4354" strokeWidth="1.2" />
          <line x1="8" x2="140" y1="181" y2="181" stroke="#3a4354" strokeWidth="1.6" />
          <text x="72" y="200" textAnchor="middle" fontSize="11" fill="#5a6470">Power plant</text>
        </g>

        {/* step-up transformer */}
        <g {...hp('stepup')}>
          <Xfmr x={178} y={128} />
          <text x="198" y="200" textAnchor="middle" fontSize="11" fill="#5a6470">Step-up</text>
        </g>

        {/* transmission tower */}
        <g {...hp('tower')}>
          <rect x="262" y="50" width="76" height="140" fill="transparent" />
          <g stroke="#2a3140" strokeWidth="1.6" fill="none">
            <path d="M300,52 L272,182 M300,52 L328,182 M280,146 L320,146 M284,118 L316,118 M289,92 L311,92" />
            <path d="M280,146 L316,118 M320,146 L284,118 M284,118 L311,92 M316,118 L289,92 M272,182 L320,146 M328,182 L280,146" strokeWidth="1" />
            <path d="M270,72 H330 M276,92 H324" />
          </g>
          <text x="300" y="200" textAnchor="middle" fontSize="11" fill="#5a6470">High-voltage lines</text>
        </g>

        {/* distribution transformer (DT) */}
        <g {...hp(vpp ? 'dtVpp' : 'dt')}>
          <Xfmr x={418} y={128} hot={!vpp} ok={vpp} />
          <text x="432" y="218" textAnchor="end" fontSize="11" fill="#5a6470">DT · 11 kV → 415 V</text>
        </g>

        {/* DT status chip */}
        <g {...hp(vpp ? 'dtVpp' : 'dtStress')}>
          <path d="M438,178 V232" stroke={vpp ? '#2f8f6b' : '#b03a26'} strokeWidth="1.4" markerEnd={`url(#${id}-ah)`} />
          <rect x="368" y="236" width="140" height="36" rx="6" fill={vpp ? '#e3f3e6' : '#fbe3e6'} stroke={vpp ? '#9fcbad' : '#e3a3ad'} />
          <text x="438" y="251" textAnchor="middle" fontSize="11" fontWeight="700" fill={vpp ? '#1f6b45' : '#b03a26'}>{vpp ? 'Peak held' : 'Load occurs'}</text>
          <text x="438" y="265" textAnchor="middle" fontSize="11" fill={vpp ? '#1f6b45' : '#b03a26'} className={vpp ? '' : 'gc-pulse'}>evening {pk}% of rating</text>
        </g>

        {/* LT poles */}
        {HOUSES.map((y, k) => (
          <g key={k} {...hp('pole')}>
            <rect x="476" y={y - 22} width="22" height="46" fill="transparent" />
            <path d={`M487,${y - 18} V${y + 22} M479,${y - 12} H495`} stroke="#2a3140" strokeWidth="1.8" />
          </g>
        ))}

        {/* homes */}
        {vpp && <g {...hp('prosumer')}><rect x="540" y="32" width="96" height="216" rx="6" fill="#efe9fb" stroke="#a48fd6" strokeDasharray="5 4" /><text x="588" y="45" textAnchor="middle" fontSize="11" fontWeight="800" fill="#4b3a8f">PROSUMER</text></g>}
        {HOUSES.map((y, k) => (
          <g key={k}>
            <g {...hp(vpp ? 'prosumer' : 'home')}>
              <path d={`M548,${y} L570,${y - 20} L592,${y} Z`} fill="#e0573a" stroke="#2a3140" strokeWidth="1.2" />
              <rect x="552" y={y} width="36" height="24" fill="#f6e3c3" stroke="#2a3140" strokeWidth="1.2" />
              <rect x="557" y={y + 6} width="7" height="7" fill="#7fa3c9" /><rect x="577" y={y + 6} width="7" height="7" fill="#7fa3c9" />
              <rect x="566" y={y + 10} width="7" height="14" fill="#8a5d0f" />
            </g>
            {vpp && (
              <>
                <g {...hp('solar')}>
                  <path d={`M600,${y - 22} H632 L628,${y - 4} H596 Z`} fill="#3b6fc4" stroke="#1f3f7a" />
                  <path d={`M603,${y - 13} H627 M609,${y - 22} V${y - 4} M619,${y - 22} V${y - 4}`} stroke="#a9c6f0" strokeWidth="0.8" />
                </g>
                <g {...hp('battery')}>
                  <rect x="604" y={y} width="20" height="26" rx="3" fill="#ffffff" stroke="#2f8f6b" strokeWidth="1.6" />
                  <rect x="610" y={y - 3} width="8" height="3" fill="#2f8f6b" />
                  <rect x="606" y={y + 9} width="16" height="15" rx="1.5" fill="#7cc79a" />
                  <path d={`M615,${y + 5} L611,${y + 14} H615 L613,${y + 22} L619,${y + 12} H615 Z`} fill="#1f6b45" />
                </g>
              </>
            )}
          </g>
        ))}

        {/* direction bar */}
        <g {...hp(vpp ? 'bi' : 'uni')}>
          <rect x="60" y="270" width="520" height="56" fill="transparent" />
          <line x1="90" x2="560" y1="286" y2="286" stroke={flowC} strokeWidth="2.6" markerEnd={`url(#${id}-ah)`} markerStart={vpp ? `url(#${id}-ah)` : undefined} />
          <rect x={vpp ? 230 : 250} y="296" width={vpp ? 180 : 140} height="24" rx="6" fill={vpp ? '#e6e9fb' : '#fbe3e6'} />
          <text x="320" y="313" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1f2a5c">{vpp ? 'Bidirectional (local)' : 'Unidirectional'}</text>
        </g>
      </svg>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-fgb">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: vpp ? '#c98a1b' : '#d0453a' }} />power from the grid</span>
        {vpp && <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: '#2f8f6b' }} />power from home solar / batteries to the DT</span>}
        {vpp ? <span className="rounded bg-[#fbe3e6] px-2 py-0.5 font-semibold text-fg">Reduces peak load on the DT and feeder</span>
          : <span className="rounded bg-[#fbe3e6] px-2 py-0.5 font-semibold text-fg">All evening peak comes from upstream</span>}
      </div>
    </div>
  )
}

function Xfmr({ x, y, hot, ok }) {
  const glow = hot ? '#e8857a' : ok ? '#7cc79a' : null
  return (
    <g>
      <rect x={x - 4} y={y - 8} width="48" height="58" fill="transparent" />
      {glow && <rect x={x - 3} y={y - 3} width="46" height="50" rx="6" fill={glow} opacity="0.35" className={hot ? 'gc-pulse' : ''} />}
      <rect x={x + 6} y={y - 6} width="5" height="8" fill="#5a6470" /><rect x={x + 29} y={y - 6} width="5" height="8" fill="#5a6470" />
      <rect x={x} y={y + 2} width="40" height="36" rx="3" fill="#aab8c8" stroke="#2a3140" strokeWidth="1.2" />
      {[6, 12, 18, 24, 30].map(d => <line key={d} x1={x + d + 2} x2={x + d + 2} y1={y + 6} y2={y + 34} stroke="#56657a" strokeWidth="1.2" />)}
      <rect x={x - 4} y={y + 38} width="48" height="6" rx="1" fill="#c9d1da" stroke="#2a3140" strokeWidth="1" />
    </g>
  )
}
