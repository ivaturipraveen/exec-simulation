import type { LedgerView } from '../api/types'
import { money } from '../lib/format'

export function LedgerPanel({ ledger, estimate }: { ledger: LedgerView; estimate?: boolean }) {
  const committedPct =
    ledger.granted > 0 ? Math.min(100, (ledger.committed / ledger.granted) * 100) : 0
  const over = ledger.available < 0
  return (
    <div className="ledger">
      <div className="row spread">
        <span className="upper muted">Capital{estimate ? ' (estimate)' : ''}</span>
        <span className={`num strong ${over ? 'delta-down' : ''}`}>
          {money(ledger.available)} available
        </span>
      </div>
      <div
        className="ledger__bar"
        role="img"
        aria-label={`${money(ledger.committed)} committed of ${money(ledger.granted)}`}
      >
        <div
          className="ledger__fill"
          style={{
            width: `${committedPct}%`,
            background: over ? 'var(--critical)' : 'var(--accent)',
          }}
        />
      </div>
      <dl className="ledger__grid">
        <div>
          <dt>Granted</dt>
          <dd className="num">{money(ledger.granted)}</dd>
        </div>
        <div>
          <dt>Committed</dt>
          <dd className="num">{money(ledger.committed)}</dd>
        </div>
        <div>
          <dt>Spent</dt>
          <dd className="num">{money(ledger.spent)}</dd>
        </div>
        <div>
          <dt>Recoverable</dt>
          <dd className="num">{money(ledger.recoverable)}</dd>
        </div>
        {ledger.paused > 0 && (
          <div>
            <dt>Paused</dt>
            <dd className="num">{money(ledger.paused)}</dd>
          </div>
        )}
        {ledger.written_off > 0 && (
          <div>
            <dt>Written off</dt>
            <dd className="num">{money(ledger.written_off)}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}
