import { payFor, RATE_PER_KWH } from '../data/econ.js'

/**
 * Settlement ledger — VPP flexibility payments only (per verified kWh).
 * Solar export credit (net metering) is a separate flow on the DISCOM bill and never appears here.
 */
export default function Ledger({ rows, showHome = true, footer }) {
  const total = rows.filter(r => r.status === 'verified').reduce((a, r) => a + payFor(r.kwh), 0)
  const S = {
    verified: <span className="inline-flex items-center gap-1 rounded bg-[#e6f2ea] px-1.5 py-0.5 text-[11px] font-semibold text-grid">VERIFIED ✅</span>,
    pending: <span className="inline-flex items-center gap-1 rounded bg-[#fbf1dc] px-1.5 py-0.5 text-[11px] font-semibold text-[#7a520c]">PENDING</span>,
    zero: <span className="inline-flex items-center gap-1 rounded bg-panel2 px-1.5 py-0.5 text-[11px] font-semibold text-dim">NOT DISPATCHED</span>,
    offline: <span className="inline-flex items-center gap-1 rounded bg-[#fbe9e5] px-1.5 py-0.5 text-[11px] font-semibold text-[#9b3322]">OFFLINE · 0 kWh</span>,
    example: <span className="inline-flex items-center gap-1 rounded border border-dashed border-solar/50 px-1.5 py-0.5 text-[11px] font-semibold text-[#7a520c]">EXAMPLE · synthetic</span>,
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-wider text-dim">
            <th className="py-2 pr-3 font-semibold">Date</th><th className="pr-3 font-semibold">Event</th>
            {showHome && <th className="pr-3 font-semibold">Home</th>}
            <th className="pr-3 text-right font-semibold">Delivered</th><th className="pr-3 text-right font-semibold">Rate</th>
            <th className="pr-3 text-right font-semibold">Payment</th><th className="font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {rows.map((r, k) => (
            <tr key={k} className="border-b border-line/60 align-top">
              <td className="py-2 pr-3 text-fg">{r.date}</td>
              <td className="pr-3 font-sans text-fgb">{r.event}{r.note && <div className="text-[11px] text-dim">{r.note}</div>}</td>
              {showHome && <td className="pr-3 text-fg">#{r.home}</td>}
              <td className="pr-3 text-right text-fg">{r.status === 'pending' ? '—' : `${r.kwh.toFixed(2)} kWh`}</td>
              <td className="pr-3 text-right text-dim">₹{RATE_PER_KWH}</td>
              <td className="pr-3 text-right font-semibold text-fg">{r.status === 'verified' ? `₹${payFor(r.kwh).toFixed(2)}` : r.status === 'example' ? <span className="text-dim">(₹{payFor(r.kwh).toFixed(2)})</span> : '₹0.00'}</td>
              <td className="font-sans">{S[r.status]}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={showHome ? 5 : 4} className="pt-2 text-right text-xs text-dim">Total VPP flexibility payments (verified)</td>
            <td className="pr-3 pt-2 text-right font-mono font-bold text-fg">₹{total.toFixed(2)}</td><td />
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 text-[11px] text-dim">
        {footer || <>Type: <b>VPP flexibility payment</b> for verified battery delivery · ₹{RATE_PER_KWH}/kWh is an illustrative pilot rate. Solar export credit (net metering) is settled separately on the electricity bill.</>}
      </p>
    </div>
  )
}
