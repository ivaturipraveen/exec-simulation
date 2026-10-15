import { FileDown } from 'lucide-react'
import { useState } from 'react'
import { errorMessage } from '../api/client'
import type { OpportunityMap, SessionView } from '../api/types'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { useToast } from '../components/ui/toastContext'
import { downloadPosted } from '../lib/download'

type Item = OpportunityMap['items'][number]

const QUADRANT: Record<Item['quadrant'], string> = {
  act_now: 'Act now',
  strategic: 'Strategic',
  quick_win: 'Quick win',
  defer: 'Defer',
}

/**
 * One-page AI Opportunity Map per company (Settings → One-page Opportunity Map export). The
 * facilitator picks what goes on the page; only that company's shared opportunities are offered.
 */
export function OnePagerExport({
  session,
  token,
  items,
}: {
  session: SessionView
  token: string
  items: Item[]
}) {
  const toast = useToast()
  const [team, setTeam] = useState<{ id: string; name: string } | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const companies = session.teams.filter((t) => items.some((o) => o.team === t.team_name))
  if (!companies.length) return null
  const teamItems = team ? items.filter((o) => o.team === team.name) : []

  const open = (id: string, name: string) => {
    setTeam({ id, name })
    setPicked(new Set(items.filter((o) => o.team === name).map((o) => o.id)))
  }
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const exportPdf = async () => {
    if (!team) return
    setBusy(true)
    try {
      const slug = team.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company'
      await downloadPosted(
        `/sessions/${session.id}/teams/${team.id}/opportunity-onepager.pdf`,
        token,
        { item_ids: teamItems.filter((o) => picked.has(o.id)).map((o) => o.id) },
        `AI-Opportunity-Map_${slug}.pdf`,
      )
      setTeam(null)
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="row wrap">
        {companies.map((t) => (
          <Button
            key={t.team_id}
            size="sm"
            icon={<FileDown />}
            title={`One-page map for the client: ${t.team_name}`}
            onClick={() => open(t.team_id, t.team_name)}
          >
            {t.team_name}
          </Button>
        ))}
      </div>
      <Dialog
        open={team !== null}
        onClose={() => setTeam(null)}
        title={`One-page map: ${team?.name ?? ''}`}
        subtitle="Choose what goes on the page. Only this company's shared opportunities are listed."
        footer={
          <>
            <Button variant="ghost" onClick={() => setTeam(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={<FileDown />}
              loading={busy}
              disabled={picked.size === 0}
              onClick={exportPdf}
            >
              Export PDF ({teamItems.filter((o) => picked.has(o.id)).length})
            </Button>
          </>
        }
      >
        <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
          {teamItems.map((o) => (
            <label key={o.id} className="checkbox">
              <input type="checkbox" checked={picked.has(o.id)} onChange={() => toggle(o.id)} />
              <span>
                {o.title}
                <span className="muted small">
                  {' '}
                  · {QUADRANT[o.quadrant]} · {o.participant}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Dialog>
    </>
  )
}
