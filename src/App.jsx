import { useEffect, useMemo, useState } from 'react'
import { buildSimulation } from './sim/engine.js'
import { useDemo } from './story.js'
import { fmtHr } from './sim/model.js'
import OverviewPage from './pages/OverviewPage.jsx'
import CommunityPage from './pages/CommunityPage.jsx'
import DiscomPage from './pages/DiscomPage.jsx'
import HomePage from './pages/HomePage.jsx'
import ImpactPage from './pages/ImpactPage.jsx'
import RoadmapPage from './pages/RoadmapPage.jsx'

const VIEWS = [['overview', 'Overview'], ['community', 'Community'], ['discom', 'DISCOM'], ['home', 'My Home'], ['impact', 'Impact'], ['roadmap', 'Roadmap']]

function initialView() {
  try {
    const q = new URLSearchParams(window.location.search).get('view')
    const h = window.location.hash.replace('#', '')
    const v = q || h || localStorage.getItem('ff.view')
    return VIEWS.some(([k]) => k === v) ? v : 'community'
  } catch { return 'community' }
}

export default function App() {
  // homeowner reserve overrides (the reserve-slider demo) re-run the whole simulation
  const [overrides, setOverrides] = useState(() => {
    // optional ?res=58:0.8 preset (rehearsal / testing) — same path as the slider
    try {
      const q = new URLSearchParams(window.location.search).get('res')
      if (!q) return { reserve: {} }
      return { reserve: Object.fromEntries(q.split(',').map(x => x.split(':')).map(([i, r]) => [+i, Math.min(0.95, Math.max(0.1, +r))])) }
    } catch { return { reserve: {} } }
  })
  const sim = useMemo(() => buildSimulation(20260927, overrides), [overrides])
  const setReserve = (id, r) => setOverrides(o => ({ reserve: { ...o.reserve, [id]: r } }))
  const resetReserves = () => setOverrides({ reserve: {} })
  const demo = useDemo()
  const [view, setView] = useState(initialView)
  const [homeId, setHomeId] = useState(() => {
    try { const v = +new URLSearchParams(window.location.search).get('home'); return v >= 1 && v <= 500 ? v : 137 } catch { return 137 }
  })
  useEffect(() => {
    try { localStorage.setItem('ff.view', view) } catch { /* storage unavailable */ }
    try { if (window.location.hash !== '#' + view) history.replaceState(null, '', '#' + view) } catch { /* sandboxed */ }
  }, [view])
  const go = v => { setView(v); window.scrollTo?.({ top: 0 }) }

  return (
    <div className="min-h-full">
      <header className="sticky z-40 border-b border-line bg-white/95 backdrop-blur" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex max-w-[1680px] items-center gap-4 px-4 sm:px-6">
          <button onClick={() => go('overview')} className="flex items-center gap-2 py-3">
            <svg width="24" height="24" viewBox="0 0 26 26" aria-hidden="true">
              <rect x="1" y="1" width="24" height="24" rx="6" fill="#1f6b45" />
              <path d="M14.5 5 L8 14.2 H12.3 L11 21 L18 11.4 H13.6 Z" fill="#e8f3ec" />
            </svg>
            <span className="font-display text-[17px] font-extrabold tracking-tight text-fg">FeederFleet</span>
          </button>
          <nav className="-mb-px flex overflow-x-auto" aria-label="Main">
            {VIEWS.map(([k, label]) => (
              <button key={k} onClick={() => go(k)}
                className={`whitespace-nowrap border-b-2 px-3 py-4 text-[13px] font-semibold transition-colors ${view === k ? 'border-grid text-fg' : 'border-transparent text-dim hover:text-fg'}`}>
                {label}
              </button>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-3 md:flex">
            <span className="font-mono text-xs text-dim">{demo.started ? `Demo ${fmtHr(demo.hour)}` : ''}</span>
            <span className="rounded border border-line px-2 py-1 text-[11px] text-dim">Hypothetical Gujarat 11 kV feeder — <span className="font-semibold text-[#7a520c]">🖥 simulated</span></span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1680px] px-4 pb-10 pt-3 sm:px-6">
        {view === 'overview' && <OverviewPage sim={sim} go={go} demo={demo} />}
        {view === 'community' && <CommunityPage sim={sim} demo={demo} setReserve={setReserve} resetReserves={resetReserves} overrides={overrides} onOpenHome={id => { setHomeId(id); go('home') }} />}
        {view === 'discom' && <DiscomPage sim={sim} demo={demo} />}
        {view === 'home' && <HomePage sim={sim} homeId={homeId} setHomeId={setHomeId} demo={demo} setReserve={setReserve} />}
        {view === 'impact' && <ImpactPage sim={sim} />}
        {view === 'roadmap' && <RoadmapPage />}
      </main>

      <footer className="border-t border-line bg-white py-6 text-center text-xs text-dim">
        <p>FeederFleet · Avartan &rsquo;26, IIT Gandhinagar · Track 8 &ldquo;The Feeder as a Power Plant&rdquo;</p>
        <p className="mt-1">Concept demo. Hypothetical feeder; every demo number is 🖥 simulated unless marked verified. We claim an India-specific integration of proven mechanisms, not a new VPP.</p>
      </footer>
    </div>
  )
}
