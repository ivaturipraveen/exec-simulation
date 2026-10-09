import { FileSpreadsheet, FileText } from 'lucide-react'
import { useArtifact } from '../api/hooks'
import { errorMessage } from '../api/client'
import { DOMAIN_LABELS, FORMAT_LABELS } from '../lib/format'
import { Markdown } from './ui/Markdown'
import { Callout, Loading } from './ui/primitives'

export function ArtifactViewer({ id }: { id: string }) {
  const { data, isPending, error } = useArtifact(id)
  if (isPending) return <Loading label="Opening document…" />
  if (error) return <Callout tone="critical">{errorMessage(error)}</Callout>
  return (
    <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
      <div className="row">
        {data.kind === 'table' ? (
          <FileSpreadsheet size={18} aria-hidden />
        ) : (
          <FileText size={18} aria-hidden />
        )}
        <div>
          <h2>{data.title}</h2>
          <div className="xs muted">
            <span className="code-chip">{data.id}</span> {FORMAT_LABELS[data.format] ?? data.format}{' '}
            · {DOMAIN_LABELS[data.domain] ?? data.domain} · Simulated, fictional data
          </div>
        </div>
      </div>
      {data.markdown != null && <Markdown>{data.markdown}</Markdown>}
      {data.columns && data.rows && (
        <div
          className="table-wrap"
          style={{
            maxHeight: '62vh',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        >
          <table className="table table--compact">
            <thead>
              <tr>
                {data.columns.map((c) => (
                  <th key={c}>{c.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) => (
                    <td key={j} className={/^-?[\d.,%$]+$/.test(cell) ? 'num' : undefined}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
