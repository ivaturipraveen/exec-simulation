import { Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { errorMessage, request } from '../api/client'
import { useCatalog, useOpportunityMap } from '../api/hooks'
import type { SessionView } from '../api/types'
import { OpportunityMatrix } from '../components/OpportunityMatrix'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Markdown } from '../components/ui/Markdown'
import { Field, Input } from '../components/ui/Field'
import { Callout, Loading, Stat } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'

export function OpportunityPanel({ session, token }: { session: SessionView; token: string }) {
  const { data } = useOpportunityMap(session.id, token, true)
  const { data: catalog } = useCatalog()
  const [synthesis, setSynthesis] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()
  if (!data) return <Loading />
  const c = data.counts
  const opp = catalog?.opportunity
  const v = opp?.act_now_value ?? 4
  const r = opp?.act_now_readiness ?? 4
  const purge = async () => {
    if (
      !window.confirm(
        'Delete every captured opportunity and consent record in this session? This cannot be undone.',
      )
    )
      return
    setDeleting(true)
    try {
      await request('POST', `/sessions/${session.id}/opportunities/delete`, {
        token,
        body: { note },
      })
      setNote('')
      setSynthesis(null)
      toast('Opportunity data deleted')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setDeleting(false)
    }
  }
  const synthesize = async () => {
    setBusy(true)
    try {
      const r = await request<{ synthesis: string }>(
        'POST',
        `/sessions/${session.id}/opportunity-map/synthesis`,
        { token },
      )
      setSynthesis(r.synthesis)
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <div className="grid grid-4">
        <Stat label="Act now" value={c.act_now ?? 0} meta={`Value ${v}+, readiness ${r}+`} />
        <Stat
          label="Strategic initiatives"
          value={c.strategic ?? 0}
          meta={`Value ${v}+, readiness under ${r}`}
        />
        <Stat label="Selective quick wins" value={c.quick_win ?? 0} />
        <Stat
          label="Foundational band"
          value={data.foundational.length}
          meta={`Themes enabling ${opp?.foundational_min_links ?? 3}+ opportunities`}
        />
      </div>
      <div className="grid grid-split">
        <Card
          title="Organizational AI Opportunity Map"
          subtitle="Aggregated from participants who consented"
        >
          <OpportunityMatrix
            themes={catalog?.opportunity.foundational_themes}
            minLinks={catalog?.opportunity.foundational_min_links}
            valueCut={v}
            readinessCut={r}
            items={data.items.map((o) => ({
              id: o.id,
              title: o.title,
              value: o.value,
              readiness: o.readiness_avg,
              foundations: o.foundations,
              meta: `${o.team} · ${o.participant}${o.owner ? ` · owner ${o.owner}` : ''}`,
            }))}
          />
        </Card>
        <Card
          title="Synthesizer"
          subtitle="Themes, act-now pilots, foundations and the first 90 days"
          actions={
            <Button
              size="sm"
              variant="primary"
              icon={<Sparkles />}
              loading={busy}
              onClick={synthesize}
              disabled={!data.items.length}
            >
              Synthesize
            </Button>
          }
        >
          {synthesis ? (
            <Markdown>{synthesis}</Markdown>
          ) : (
            <p className="small muted">
              Run the synthesizer once participants have captured their opportunities.
            </p>
          )}
        </Card>
      </div>
      <Callout tone="neutral">
        Only consented opportunities are included; named owners appear only on the organization's
        own map. Retained {opp?.retention_months ?? 12} months unless deletion is requested. Frame
        follow-up as optional diligence.
      </Callout>
      <Card
        title="Delete opportunity data"
        subtitle="OD-09: on the organization's request, remove every captured opportunity and consent"
      >
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="grow">
            <Field label="Audit note">
              {(id) => (
                <Input
                  id={id}
                  value={note}
                  maxLength={1000}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Who asked, and when"
                />
              )}
            </Field>
          </div>
          <Button
            variant="danger"
            icon={<Trash2 />}
            loading={deleting}
            disabled={!note.trim()}
            onClick={purge}
          >
            Delete
          </Button>
        </div>
      </Card>
    </div>
  )
}
