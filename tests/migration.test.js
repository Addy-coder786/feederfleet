// Gujarat → Wakad–Tathawade (Pune) migration regression checks.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PILOT, FEEDER_LABEL, DATA_STATUS } from '../src/config/pilot.js'
import { SCENARIOS } from '../src/config/scenario.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const walk = d => readdirSync(d).flatMap(f => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
const SRC_FILES = walk(join(ROOT, 'src')).filter(f => /\.(js|jsx)$/.test(f))

describe('pilot location', () => {
  it('is Wakad–Tathawade, Pune, with MSEDCL as a proposed stakeholder and MERC as regulator', () => {
    expect(PILOT.area).toBe('Wakad–Tathawade')
    expect(PILOT.city).toMatch(/Pune/)
    expect(PILOT.state).toBe('Maharashtra')
    expect(PILOT.utility.short).toBe('MSEDCL')
    expect(PILOT.utility.relation).toMatch(/no engagement/i)
    expect(PILOT.regulator.short).toBe('MERC')
    expect(FEEDER_LABEL).toMatch(/Synthetic/)
    expect(FEEDER_LABEL).toMatch(/Wakad–Tathawade/)
  })
  it('page metadata names the new pilot area', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
    expect(html).toMatch(/Wakad–Tathawade/)
    expect(html).not.toMatch(/Gujarat/)
  })
})

describe('no leftover Gujarat pilot assumptions', () => {
  // Allowed: lines that describe the Track 8 brief itself (the brief is written for Gujarat).
  const BANNED = /Gujarat|GERC|GUVNL|DGVCL|UGVCL|MGVCL|PGVCL|GEDA|Anand|Torrent|Surat/
  it('source files mention Gujarat only when describing the hackathon brief', () => {
    const hits = []
    for (const f of SRC_FILES) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (BANNED.test(line) && !/brief/i.test(line)) hits.push(`${f.replace(ROOT, '')}:${i + 1}: ${line.trim().slice(0, 100)}`)
      })
    }
    expect(hits).toEqual([])
  })
  it('the feeder is labelled 22 kV (11 kV appears only for the brief / general glossary)', () => {
    const hits = []
    for (const f of SRC_FILES) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        // "22/11 kV" substation ratios are fine; a bare "11 kV" feeder label is not
        if (/(?<!\/)11 kV/.test(line) && !/brief|many places/i.test(line)) hits.push(`${f.replace(ROOT, '')}:${i + 1}`)
      })
    }
    expect(hits).toEqual([])
    expect(PILOT.kv).toBe('22 kV')
  })
  it('the old Gujarat demo date is gone', () => {
    for (const f of SRC_FILES) expect(readFileSync(f, 'utf8')).not.toMatch(/27 Sep/)
  })
})

describe('provenance', () => {
  const LEDGER_DIR = join(ROOT, '..', 'research', 'sources')
  const ledgerIds = existsSync(LEDGER_DIR)
    ? new Set(readdirSync(LEDGER_DIR).filter(f => f.endsWith('.csv'))
      .flatMap(f => readFileSync(join(LEDGER_DIR, f), 'utf8').split('\n').map(l => l.split(',')[0].trim())))
    : null
  const ID = /\b(PUNE-[LR]-\d{3}|SUR-\d{3}|GRID-\d{3}|R2-IN-\d{3})\b/g

  it('every data-status row has a known status, and non-missing rows cite a ledger id', () => {
    for (const r of DATA_STATUS) {
      expect(['VERIFIED', 'PROXY', 'SYNTHETIC', 'MISSING', 'UNVERIFIED']).toContain(r.status)
      expect(r.how.length).toBeGreaterThan(5)
      if (r.status === 'VERIFIED' || r.status === 'PROXY') expect(r.found).toMatch(ID)
    }
  })
  it('scenario solar yields cite a ledger id', () => {
    for (const s of Object.values(SCENARIOS)) {
      expect(s.pvYield.src).toMatch(ID)
      expect(s.pvYield.unit).toBe('kWh/kWp/day')
    }
  })
  it.skipIf(!ledgerIds)('every ledger id cited in the source exists in research/sources/*.csv', () => {
    const cited = new Set(SRC_FILES.flatMap(f => readFileSync(f, 'utf8').match(ID) || []))
    const missing = [...cited].filter(id => !ledgerIds.has(id))
    expect(missing).toEqual([])
  })
})
