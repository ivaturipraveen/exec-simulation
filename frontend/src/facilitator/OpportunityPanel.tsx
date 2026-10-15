import { Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { errorMessage, request } from '../api/client'
import { useCatalog, useOpportunityMap } from '../api/hooks'
import type { OrganizationMap, SessionView } from '../api/types'
import { OpportunityMatrix } from '../components/OpportunityMatrix'
import { Button } from '../components/ui/Button'
import { SectionTabs } from '../components/SectionTabs'
import { Card } from '../components/ui/Card'
import { Markdown } from '../components/ui/Markdown'
import { Field, Input } from '../components/ui/Field'
import { Badge, Callout, Loading, Stat } from '../components/ui/primitives'
import { useConfirm, useToast } from '../components/ui/toastContext'

export function OpportunityPanel({ session, token }: { session: SessionView; token: string }) {
  const { data } = useOpportunityMap(session.id, token, true)
  const { data: catalog } = useCatalog()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()
  const confirm = useConfirm()
  if (!data) return <Loading />
  const c = data.counts
  const opp = catalog?.opportunity
  const v = opp?.act_now_value ?? 4
  const r = opp?.act_now_readiness ?? 4
  const purge = async () => {
    if (
      !(await confirm({
        title: 'Delete all opportunity data?',
        message:
          'Every captured opportunity and consent record in this session is removed. This cannot be undone.',
        tone: 'danger',
        confirmLabel: 'Delete data',
      }))
    )
      return
    setDeleting(true)
    try {
      await request('POST', `/sessions/${session.id}/opportunities/delete`, {
        token,
        body: { note },
      })
      setNote('')
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
      // Saved on the server; the console, projector, teams and export all refresh from it.
      await request('POST', `/sessions/${session.id}/opportunity-map/synthesis`, { token })
      toast('Synthesis shared with the projector and every team')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      {data.awaiting_consent > 0 && (
        <Callout tone="accent" title={`${data.awaiting_consent} captured, waiting for consent`}>
          These opportunities are saved by their teams but stay off this map until each author ticks
          “share” on their Opportunity map page.
        </Callout>
      )}
      <div className="grid grid-5">
        <Stat label="Act now" value={c.act_now ?? 0} meta={`Value ${v}+, readiness ${r}+`} />
        <Stat
          label="Strategic initiatives"
          value={c.strategic ?? 0}
          meta={`Value ${v}+, readiness under ${r}`}
        />
        <Stat
          label="Selective quick wins"
          value={c.quick_win ?? 0}
          meta={`Value under ${v}, readiness ${r}+`}
        />
        <Stat label="Defer" value={c.defer ?? 0} meta={`Value under ${v}, readiness under ${r}`} />
        <Stat
          label="Foundational band"
          value={data.foundational.length}
          meta={`Themes enabling ${opp?.foundational_min_links ?? 3}+ opportunities`}
        />
      </div>
      <SectionTabs
        label="Opportunity map sections"
        sections={[
          {
            id: 'map',
            label: 'Opportunity map',
            count: data.items.length,
            content: (
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
            ),
          },
          {
            id: 'synth',
            label: 'Synthesizer',
            content: (
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
                    {data.synthesis ? 'Regenerate' : 'Synthesize'}
                  </Button>
                }
              >
                {data.synthesis ? (
                  <div className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
                    <SynthesisMeta s={data.synthesis} />
                    {data.synthesis.stale && (
                      <Callout
                        tone="accent"
                        title="New or changed opportunities since this was written"
                      >
                        Regenerate to include them. Teams and the projector keep showing this
                        version until you do.
                      </Callout>
                    )}
                    <Markdown>{data.synthesis.text}</Markdown>
                  </div>
                ) : (
                  <p className="small muted">
                    Run the synthesizer once participants have captured and shared their
                    opportunities. The result is saved and shown on the projector and every team's
                    Opportunity map page.
                  </p>
                )}
              </Card>
            ),
          },
          {
            id: 'privacy',
            label: 'Data & privacy',
            content: (
              <div className="stack">
                <Callout tone="neutral">
                  Only consented opportunities are included; named owners appear only on the
                  organization's own map. Retained {opp?.retention_months ?? 12} months unless
                  deletion is requested. Frame follow-up as optional diligence.
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
            ),
          },
        ]}
      />
    </div>
  )
}

/** Who wrote it, when, and from how many opportunities. */
export function SynthesisMeta({ s }: { s: OrganizationMap }) {
  return (
    <div className="synthesis-meta">
      <Badge tone={s.generative ? 'accent' : 'neutral'} icon={<Sparkles size={12} aria-hidden />}>
        {s.generative ? 'Claude synthesizer' : 'Listing (AI not configured)'}
      </Badge>
      <span className="xs muted">
        {new Date(s.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · from{' '}
        {s.items} opportunit{s.items === 1 ? 'y' : 'ies'}
      </span>
    </div>
  )
}
