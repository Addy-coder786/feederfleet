// Server-side render of every page: catches crashes (e.g. reading a missing event) without a browser.
import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { buildSimulation } from '../src/sim/engine.js'
import OverviewPage from '../src/pages/OverviewPage.jsx'
import CommunityPage from '../src/pages/CommunityPage.jsx'
import DiscomPage from '../src/pages/DiscomPage.jsx'
import HomePage from '../src/pages/HomePage.jsx'
import ImpactPage from '../src/pages/ImpactPage.jsx'
import RoadmapPage from '../src/pages/RoadmapPage.jsx'
import NoEventNotice from '../src/components/NoEventNotice.jsx'

vi.spyOn(console, 'warn').mockImplementation(() => {}) // Recharts warns about zero size under SSR
const noop = () => {}
const demoAt = sec => ({ sec, hour: 0, running: false, started: true, start: noop, pause: noop, restart: noop, seek: noop })
const sim = buildSimulation()
const overrides = { reserve: {} }

describe('pages render with the pre-monsoon story day', () => {
  // story seconds covering every overlay: rest, midday, forecast, matching, dispatch, replan, result, settle
  for (const sec of [0, 10, 16, 25, 33, 38, 46, 55, 60]) {
    it(`Community + Overview at demo second ${sec}`, () => {
      const demo = { ...demoAt(sec), hour: [6, 11, 15, 19, 20.5, 21.5, 22.75, 23.4, 23.75][[0, 10, 16, 25, 33, 38, 46, 55, 60].indexOf(sec)] }
      const community = renderToString(<CommunityPage sim={sim} demo={demo} onOpenHome={noop} setReserve={noop} resetReserves={noop} overrides={overrides} />)
      expect(community).toMatch(/FEEDERFLEET/)
      expect(community).toMatch(/Sensors → algorithm → actions/)
      expect(community).toMatch(/Worked example/)
      const overview = renderToString(<OverviewPage sim={sim} go={noop} demo={demo} />)
      expect(overview).toMatch(/Wakad–Tathawade/)
      expect(overview).toMatch(/Hardware ↔ software connection/)
    })
  }
  it('DISCOM page shows the replan and the shortfall', () => {
    const html = renderToString(<DiscomPage sim={sim} demo={demoAt(0)} />)
    expect(html).toMatch(/DISCOM control room/)
    expect(html).toMatch(/15 May/)
  })
  it.each([137, 58, 17, 41, 229, 312, 141, 204, 1, 500])('My Home page for home #%i', id => {
    expect(renderToString(<HomePage sim={sim} homeId={id} setHomeId={noop} demo={demoAt(0)} setReserve={noop} />)).toMatch(/HOME #/)
  })
  it('Impact and Roadmap pages', () => {
    const html = renderToString(<ImpactPage sim={sim} overrides={overrides} />)
    expect(html).toMatch(/Local data status/)
    expect(html).toMatch(/three Pune days/)
    expect(renderToString(<RoadmapPage />)).toMatch(/MSEDCL/)
  })
})

describe('days without a DT event', () => {
  for (const id of ['pune-monsoon', 'pune-winter']) {
    it(`${id}: empty state and Impact page render`, () => {
      const s = buildSimulation(undefined, {}, id)
      expect(s.hero).toBeNull()
      expect(renderToString(<NoEventNotice sim={s} go={noop} onDefault={noop} />)).toMatch(/No transformer event/)
      expect(renderToString(<ImpactPage sim={s} overrides={overrides} />)).toMatch(/Impact/)
    })
  }
})
