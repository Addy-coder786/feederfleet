import { MONTHS, GANTT, GATE, BLOCKERS, RSRC } from '../data/roadmap.js'
import { FUNDING } from '../data/funding.js'
import { PILOT } from '../config/pilot.js'
import { Tag, PanelTitle } from '../components/ui.jsx'

const WEEKS = 13

export default function RoadmapPage() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-2xl font-extrabold">3-month pilot deployment roadmap</h2>
          <p className="text-sm text-dim">{MONTHS[0].dates.split('–')[0].trim()} → {MONTHS.at(-1).dates.split('–')[1].trim()} · {PILOT.short} · {PILOT.utility.short} (proposed) · 1–3 stressed DTs · 15–20 confirmed-compatible homes per DT</p>
        </div>
        <span className="ml-auto flex gap-1.5"><Tag t="FACT">Fact = source opened</Tag><Tag t="INFERENCE">Inference = our plan</Tag></span>
      </div>

      {/* Gantt */}
      <div className="rounded-lg border border-line bg-white p-4 shadow-card">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[230px_1fr] text-[11px] font-semibold uppercase tracking-wider text-dim">
              <div />
              <div className="grid grid-cols-3 border-b border-line pb-1.5">
                {MONTHS.map(m => <div key={m.m} className="px-1">{m.m} · {m.title}<div className="font-mono text-[10px] font-normal normal-case tracking-normal">{m.dates}</div></div>)}
              </div>
            </div>
            {GANTT.map(([l, a, b], k) => (
              <div key={l} className="grid grid-cols-[230px_1fr] items-center border-b border-line/50 py-1.5">
                <div className="pr-3 text-sm text-fgb">{l}</div>
                <div className="relative h-5">
                  {[1, 2].map(m => <div key={m} className="absolute top-[-6px] h-[32px] border-l border-dashed border-line" style={{ left: `${(m / 3) * 100}%` }} />)}
                  <div className={`absolute h-5 rounded ${k === GANTT.length - 1 ? 'bg-[#c98a1b]' : k >= 5 && k <= 6 ? 'bg-grid' : 'bg-batt/70'}`}
                    style={{ left: `${(a / WEEKS) * 100}%`, width: `${((b - a) / WEEKS) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {MONTHS.map((m, i) => (
          <div key={m.m} className="rounded-lg border border-line bg-white p-4 shadow-card">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-grid font-mono text-sm font-bold text-white">{i + 1}</span>
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-dim">{m.m} · {m.dates}</div>
                <div className="text-lg font-extrabold uppercase text-fg">{m.title}</div>
              </div>
            </div>
            <ol className="mt-3 grid gap-2.5">
              {m.steps.map(([s, who, basis, src, note], k) => (
                <li key={k} className="border-l-2 border-line pl-3">
                  <div className="text-sm font-medium leading-snug text-fg">{s}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-dim">
                    <span className="font-semibold text-fgb">{who}</span>
                    <Tag t={basis} />
                    {src && <a href={RSRC[src].u} target="_blank" rel="noreferrer" className="text-grid underline decoration-grid/30">{RSRC[src].n}</a>}
                  </div>
                  {note && <div className="text-[11px] text-dim">{note}</div>}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-grid/30 bg-white p-4 shadow-card">
          <PanelTitle kicker="27 December 2026" title="Decision gate: scale or stop" right={<Tag t="INFERENCE">proposed</Tag>} />
          <ul className="grid gap-2">
            {GATE.map(([k, v]) => (
              <li key={k} className="flex gap-2 text-sm"><span className="text-grid">✔</span><span><b className="text-fg">{k}:</b> <span className="text-fgb">{v}</span></span></li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-dim">If all pass → expand to the next stressed DTs. If not → stop; upgrading the transformer is the better answer there.</p>
        </div>
        <FundingCard />
        <div className="rounded-lg border border-solar/40 bg-[#fffaf0] p-4 shadow-card">
          <PanelTitle kicker="Honest risks" title="Blockers & unknowns" />
          <ul className="grid gap-1.5 text-sm text-fgb">
            {BLOCKERS.map(b => <li key={b} className="flex gap-2"><span className="text-[#c98a1b]">!</span>{b}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}

function FundingCard() {
  const f = FUNDING
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <PanelTitle kicker="Who approves · who pays" title="Pilot funding route" right={<Tag t={f.tag}>{f.tagLabel}</Tag>} />
      <ol className="grid gap-1">
        {f.route.map((r, k) => (
          <li key={k} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e6f2ea] font-mono text-[10px] font-bold text-grid">{k + 1}</span>
            <span className="text-fgb">{r}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-dim">{f.note}</p>
      {f.sources.length > 0 && (
        <p className="mt-1 text-[11px]">{f.sources.map(([n, u]) => <a key={u} href={u} target="_blank" rel="noreferrer" className="mr-2 text-grid underline decoration-grid/30">{n}</a>)}</p>
      )}
    </div>
  )
}
