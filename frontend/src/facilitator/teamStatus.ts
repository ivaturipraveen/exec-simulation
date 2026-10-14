import type { SessionView, TeamProgress } from '../api/types'

type StepState = 'done' | 'now' | 'missed' | 'todo'

export interface Step {
  label: string
  kinds: string[]
  done: boolean
  value: string
  index: number
  state: StepState
  status: string
  /** Stage index after which the step counts as missed. */
  closes: number
}

/** A team's workshop steps in stage order, each marked done, live now, missed or still to come. */
export function teamSteps(t: TeamProgress, session: SessionView): Step[] {
  const c = session.clock
  const started = c.status !== 'not_started'
  const stageKind = started ? c.stage_kind : ''
  const indexOf = (kinds: string[]) => {
    const idx = session.stages.findIndex((s) => kinds.includes(s.kind))
    return idx < 0 ? Number.POSITIVE_INFINITY : idx
  }
  const raw = [
    {
      label: 'Diagnose priorities',
      kinds: ['diagnose'],
      done: t.priorities > 0,
      value: t.priorities > 0 ? `${t.priorities} set · ${t.evidence_cited} cited` : '',
    },
    {
      label: 'Investment Round 1',
      kinds: ['invest_r1'],
      done: t.round1_submitted,
      value: t.round1_submitted ? 'Submitted' : '',
    },
    {
      label: 'Board pitch',
      kinds: ['analyze', 'invest_r2'],
      done: t.pitch_submitted,
      value: t.pitch_total != null ? `${t.pitch_total}/15` : t.pitch_submitted ? 'To score' : '',
    },
    {
      label: 'Investment Round 2',
      kinds: ['invest_r2'],
      done: t.round2_submitted,
      value: t.round2_submitted ? 'Submitted' : '',
    },
    {
      label: 'Operating model',
      kinds: ['operating_model'],
      done: t.opmodel_submitted,
      value:
        t.opmodel_total != null ? `${t.opmodel_total}/12` : t.opmodel_submitted ? 'Submitted' : '',
    },
    {
      label: 'Crisis response',
      kinds: ['crisis'],
      done: t.crisis_responded,
      value:
        t.crisis_total != null
          ? `${t.crisis_total}/18`
          : t.crisis_event_id
            ? `${t.crisis_event_id.toUpperCase()} ${t.crisis_severity ?? ''} live`
            : '',
    },
    {
      label: 'Opportunity map',
      kinds: ['translate'],
      done: t.opportunities > 0,
      value: t.opportunities > 0 ? `${t.opportunities} captured` : '',
    },
  ]
  const crisisStageIndex = indexOf(['crisis'])
  return raw.map((s, index) => {
    const closes = Math.max(...s.kinds.map((k) => indexOf([k])))
    const now = started && s.kinds.includes(stageKind) && !s.done
    const missed = started && !s.done && !now && c.stage_index > closes
    const state: StepState = s.done ? 'done' : now ? 'now' : missed ? 'missed' : 'todo'
    // Until the Crisis stage ends, "no crisis" may just mean "not released yet".
    const crisisPending =
      s.kinds.includes('crisis') && !t.crisis_event_id && c.stage_index === crisisStageIndex
    const noCrisis =
      s.kinds.includes('crisis') &&
      !t.crisis_event_id &&
      started &&
      c.stage_index > crisisStageIndex
    const status =
      s.value ||
      (crisisPending
        ? 'Waiting for the crisis'
        : noCrisis
          ? 'No crisis fired (clean portfolio)'
          : state === 'now'
            ? 'Working on it now'
            : state === 'missed'
              ? 'Not submitted'
              : 'Coming up')
    return { ...s, index, state, status, closes }
  })
}

export interface Alert {
  tone: 'critical' | 'warning'
  text: string
}

/** What about this team the facilitator can act on now; the Run tab lists these under "Needs you".
 * Past events that can no longer be changed are left out. */
export function teamAlerts(t: TeamProgress, session: SessionView): Alert[] {
  const c = session.clock
  const out: Alert[] = []
  if (t.crisis_event_id && !t.crisis_responded)
    out.push({
      tone: 'critical',
      text: `Crisis ${t.crisis_event_id.toUpperCase()} (${t.crisis_severity}) waiting for a response`,
    })
  // Capacity only matters while the team can still change its portfolio.
  const roundOpen =
    (c.stage_kind === 'invest_r1' && !t.round1_submitted) ||
    (c.stage_kind === 'invest_r2' && !t.round2_submitted)
  if (roundOpen && t.capacity_peak != null && t.capacity_peak > 1)
    out.push({
      tone: t.capacity_peak > session.rules.capacity_overrun_cap ? 'critical' : 'warning',
      text: `Capacity peak ${Math.round(t.capacity_peak * 100)}% in the draft`,
    })
  if (t.needs_nudge) out.push({ tone: 'warning', text: 'No evidence cited yet: nudge them' })
  if (t.pitch_figures.length > 0)
    out.push({ tone: 'warning', text: `Unsourced figure in pitch: ${t.pitch_figures.join(', ')}` })
  // A missed step is worth flagging in the stage right after it closed, not for the rest of the day.
  for (const s of teamSteps(t, session))
    if (s.state === 'missed' && c.stage_index === s.closes + 1)
      out.push({ tone: 'warning', text: `Missed: ${s.label}` })
  return out
}
