// The 60-second demo script. Demo seconds -> simulated hour of day, captions, colour state, flowchart step.
import { useEffect, useRef, useState } from 'react'

export const DEMO_LEN = 60
export const REST_SEC = 10.5 // still frame before Start: midday, surplus flowing back

// [seconds, hour] — piecewise linear. 0–20 s = the problem only; 20 s onward = FeederFleet.
const KEYS = [[0, 6.0], [5, 10.0], [12, 13.25], [20, 19.0], [24, 19.0], [32, 20.5], [45, 22.75], [52, 23.25], [60, 23.75]]
export function hourAt(sec) {
  for (let k = 0; k < KEYS.length - 1; k++) {
    const [s1, h1] = KEYS[k], [s2, h2] = KEYS[k + 1]
    if (sec <= s2) return h1 + (h2 - h1) * Math.max(0, (sec - s1) / (s2 - s1))
  }
  return KEYS.at(-1)[1]
}
export function secAt(hour) {
  for (let k = 0; k < KEYS.length - 1; k++) {
    const [s1, h1] = KEYS[k], [s2, h2] = KEYS[k + 1]
    if (hour <= h2 && h2 > h1) return s1 + (s2 - s1) * Math.max(0, (hour - h1) / (h2 - h1))
  }
  return DEMO_LEN
}

// tone drives the colour of the caption, the map frame and the feeder line
export const PHASES = [
  { from: 0, tone: 'green', kicker: 'Morning', title: 'Solar generation rising', sub: 'Homes use their own solar first.' },
  { from: 5, tone: 'sun', kicker: 'Midday', title: 'Solar surplus', sub: 'Batteries charge. Some are already full.' },
  { from: 8.5, tone: 'amber', kicker: 'Midday', title: 'Reverse power flow', sub: 'Surplus flows back: homes → DT → 11 kV feeder → substation.' },
  { from: 12, tone: 'orange', kicker: 'Afternoon', title: 'Reverse flow pressure', sub: 'DT-10 is pushing about half its rating backwards.' },
  { from: 15.5, tone: 'red', kicker: 'Evening peak approaching', title: 'DT-10 forecast: overload tonight', sub: 'Sun sets, ACs switch on, demand climbs.' },
  { from: 20, tone: 'vpp', kicker: 'FeederFleet VPP', title: 'Finding available flexibility…', sub: 'Only homes under DT-10 can relieve DT-10.' },
  { from: 24, tone: 'vpp', kicker: 'FeederFleet VPP', title: 'Matching homes under DT-10', sub: 'Who is online, above reserve, and has energy?' },
  { from: 32, tone: 'red', kicker: 'Evening peak', title: 'Demand rising on DT-10', sub: 'Matched batteries hold their charge for the peak.' },
  { from: 35, tone: 'vpp', kicker: 'Dispatch', title: 'Local battery support active', sub: 'Selected batteries discharge into the local network.' },
  { from: 41, tone: 'vpp', kicker: 'Dispatch', title: 'DT-10 peak reduced', sub: 'DT-10 held at its 90 % target; the feeder peak falls too.' },
  { from: 45, tone: 'vpp', kicker: 'Result', title: 'Result', sub: '' },
  { from: 52, tone: 'vpp', kicker: 'Verify & settle', title: 'Delivery verified · homeowners paid', sub: 'Paid only for verified kWh. Solar export credit stays separate.' },
]
export const phaseAt = sec => [...PHASES].reverse().find(p => sec >= p.from) || PHASES[0]

export const TONES = {
  green: { c: '#1f6b45', bg: '#ffffff', ring: '#cfe3d5' },
  sun: { c: '#8a6410', bg: '#fffaf0', ring: '#ecd9a8' },
  amber: { c: '#9a5f0a', bg: '#fdf4e2', ring: '#e8c88a' },
  orange: { c: '#a4520e', bg: '#fcece0', ring: '#e7b48a' },
  red: { c: '#b03a26', bg: '#fbeae6', ring: '#e6aa9d' },
  vpp: { c: '#1f6b45', bg: '#eaf4ed', ring: '#9fcbad' },
}

export const FLOW = [
  { k: 'MEASURE', d: 'Read every home and DT each 15 min', from: 0 },
  { k: 'FORECAST', d: 'Predict loading for the next hours', from: 5 },
  { k: 'FIND STRESSED DT', d: 'DT-10: forecast overload tonight', from: 12 },
  { k: 'CHECK RESERVE', d: 'Owner reserve is a hard floor', from: 20 },
  { k: 'MATCH HOMES', d: 'Same DT · online · enough energy', from: 24 },
  { k: 'DISPATCH', d: 'Setpoints to the home gateways', from: 32 },
  { k: 'VERIFY', d: 'Actual − baseline, meter cross-check', from: 45 },
  { k: 'SETTLE', d: 'Pay per verified kWh', from: 52 },
  { k: 'REPLAN', d: 'Recharge from tomorrow’s solar', from: 57 },
]
export const flowIdx = sec => FLOW.reduce((a, f, i) => (sec >= f.from ? i : a), 0)

function initialSec() {
  try {
    const v = parseFloat(new URLSearchParams(window.location.search).get('s'))
    return Number.isFinite(v) ? Math.min(DEMO_LEN, Math.max(0, v)) : REST_SEC
  } catch { return REST_SEC }
}

/** The demo clock. `started` = the judge pressed Start at least once (story overlays only show then). */
export function useDemo() {
  const [sec, setSec] = useState(initialSec)
  const [running, setRunning] = useState(false)
  const [started, setStarted] = useState(() => initialSec() !== REST_SEC)
  const raf = useRef(), last = useRef()
  useEffect(() => {
    if (!running) return
    const tick = now => {
      if (last.current != null) {
        const d = Math.min(0.1, (now - last.current) / 1000)
        setSec(x => {
          const nx = x + d
          if (nx >= DEMO_LEN) { setRunning(false); return DEMO_LEN }
          return nx
        })
      }
      last.current = now
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf.current); last.current = null }
  }, [running])
  return {
    sec, hour: hourAt(sec), running, started,
    start: () => { if (!started || sec >= DEMO_LEN) setSec(0); setStarted(true); setRunning(true) },
    pause: () => setRunning(false),
    restart: () => { setSec(0); setStarted(true); setRunning(true) },
    seek: v => { setStarted(true); setSec(v) },
  }
}
