import { FileSpreadsheet, FileText, FolderSearch, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDataRoom } from '../api/hooks'
import { ArtifactViewer } from '../components/ArtifactViewer'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Field'
import { Badge, Empty, Loading, PageHeader } from '../components/ui/primitives'
import { DOMAIN_LABELS, FORMAT_LABELS } from '../lib/format'

export function DataRoomPage() {
  const { data, isPending } = useDataRoom()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const selected = params.get('doc')

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    const items = (data ?? []).filter(
      (a) =>
        !term ||
        `${a.id} ${a.title} ${a.summary} ${a.tags.join(' ')} ${a.format}`
          .toLowerCase()
          .includes(term),
    )
    const by = new Map<string, typeof items>()
    for (const a of items) by.set(a.domain, [...(by.get(a.domain) ?? []), a])
    return [...by.entries()]
  }, [data, q])

  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <PageHeader
        eyebrow="Evidence"
        title="Data room"
        description="Thirty artifacts across eight domains. Nothing here is labelled as the answer: three problems are hidden across several files, and some headline numbers mislead. Cite artifact IDs as evidence."
      />
      <div className="dataroom">
        <Card flush className="dataroom__list">
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
            <div className="row" style={{ position: 'relative' }}>
              <Search
                size={15}
                style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }}
                aria-hidden
              />
              <Input
                aria-label="Filter documents"
                placeholder="Filter by ID, title or topic"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ paddingLeft: 32 }}
              />
            </div>
          </div>
          {isPending ? (
            <Loading />
          ) : (
            <div className="dataroom__scroll">
              {groups.map(([dept, items]) => (
                <div key={dept} className="dataroom__group">
                  <div className="upper muted" style={{ padding: '10px 14px 4px' }}>
                    {DOMAIN_LABELS[dept] ?? dept} <span className="muted">· {items.length}</span>
                  </div>
                  {items.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`dataroom__item ${selected === a.id ? 'is-active' : ''}`}
                      onClick={() => setParams({ doc: a.id })}
                    >
                      {a.kind === 'table' ? (
                        <FileSpreadsheet aria-hidden />
                      ) : (
                        <FileText aria-hidden />
                      )}
                      <span className="grow">
                        <span className="dataroom__title">
                          <span className="code-chip">{a.id}</span> {a.title}
                        </span>
                        <span className="dataroom__summary">
                          {FORMAT_LABELS[a.format] ?? a.format} · {a.summary}
                        </span>
                      </span>
                      {a.is_new && <Badge tone="accent">New</Badge>}
                    </button>
                  ))}
                </div>
              ))}
              {groups.length === 0 &&
                ((data ?? []).length === 0 ? (
                  <Empty title="The data room is not open yet" icon={<FolderSearch aria-hidden />}>
                    Five orientation documents open at <strong>Meet your company</strong>; all
                    thirty open at <strong>Diagnose</strong>. Your facilitator moves the session on.
                  </Empty>
                ) : (
                  <Empty title="No documents match">Try another ID, title or topic.</Empty>
                ))}
            </div>
          )}
        </Card>
        <Card className="dataroom__viewer">
          {selected ? (
            <ArtifactViewer id={selected} />
          ) : (
            <Empty title="Select a document" icon={<FolderSearch aria-hidden />}>
              Eight domains: Stars and quality, members, pharmacy, experience and service,
              providers, technology and data, finance and operations, risk and governance. More
              files open as the session moves from Meet your company to Diagnose.
            </Empty>
          )}
        </Card>
      </div>
    </div>
  )
}
