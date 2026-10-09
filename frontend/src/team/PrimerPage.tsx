import { useCatalog } from '../api/hooks'
import type { GameRules, TeamView } from '../api/types'
import { Card } from '../components/ui/Card'
import { money } from '../lib/format'
import { Badge, Callout, Loading, PageHeader } from '../components/ui/primitives'

const CLASSES = [
  [
    'Generative AI',
    'Creates or transforms content from context',
    'Member communications, summaries, policy drafts',
  ],
  [
    'Predictive AI',
    'Estimates probability, risk or expected outcome',
    'Adherence risk, outreach propensity, complaint risk',
  ],
  [
    'Copilot',
    'Assists a human in a task or decision',
    'Contact-center, provider, appeals, quality-analyst copilots',
  ],
  [
    'Automation',
    'Executes deterministic, repeatable steps',
    'Routing, document extraction, status updates',
  ],
  [
    'Agent',
    'Pursues a goal across tools and steps with bounded autonomy',
    'Gap orchestration, monitoring, follow-up',
  ],
]

const GLOSSARY = (r: GameRules) => [
  [
    'Leading indicator',
    'An operational signal expected to move before formal measure and Stars outcomes.',
  ],
  [
    'Rating year vs. projected path',
    'A measure realizes a share of the full effect in the next rating year (50–70%), the rest the year after. The projected path is where you converge.',
  ],
  [
    'Capacity points',
    `Implementation bandwidth. Each card consumes points every quarter while it is built; above ${Math.round(r.capacity_overrun_cap * 100)}% of supply, everything moves at ${Math.round(r.capacity_overrun_speed * 100)}% speed.`,
  ],
  [
    'Payer fit',
    `How well a card suits your organization: High realizes ${Math.round(r.payer_effectiveness.high * 100)}% of its effect, Medium ${Math.round(r.payer_effectiveness.medium * 100)}%, Low ${Math.round(r.payer_effectiveness.low * 100)}% — before prerequisites and adoption.`,
  ],
  [
    'Selected-measure model',
    'A teaching subset of 10 Star measures — enough for credible trade-offs without the full CMS calculation.',
  ],
  [
    'AI analytical workforce',
    'AI that retrieves, analyzes, challenges and explains evidence while executives keep accountability.',
  ],
  [
    'Prerequisite and dependency',
    'Conditions on each card (identity match, outreach capacity, incentives, a named owner) that change how much of its effect lands.',
  ],
  [
    'Diminishing returns',
    `A second card acting on the same measure realizes ${Math.round(r.diminishing_returns[1] * 100)}% of its effect, a third ${Math.round(r.diminishing_returns[2] * 100)}%. Effects never exceed two-year headroom.`,
  ],
  [
    'Simplification register',
    'The documented list of where this game deliberately differs from real CMS methodology.',
  ],
]

const DIMENSIONS = (r: GameRules) => [
  [
    'Stars trajectory',
    '30%',
    `Lift ÷ headroom across the 10 measures, plus the projected path to ${r.target_stars.toFixed(1)}`,
  ],
  [
    'Member outcomes & experience',
    '20%',
    'Blood pressure, glycemic, readmissions, access, service, complaints; equity modifier',
  ],
  [
    'Financial performance',
    '20%',
    'Benefit as a share of your 4-Star bonus value; spend discipline; write-offs',
  ],
  [
    'AI transformation maturity',
    '15%',
    'Foundations live, adoption, decision rights; operating model exercise is 40%',
  ],
  [
    'Risk & governance',
    '15%',
    'Controls, incidents, subgroup monitoring, privacy; crisis rubric is 50%',
  ],
]

export function PrimerPage({ team }: { team: TeamView }) {
  const { data: catalog } = useCatalog()
  if (!catalog) return <Loading />
  const r = team.rules
  const glossary = GLOSSARY(r)
  const dimensions = DIMENSIONS(r)
  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <PageHeader
        eyebrow="Primer"
        title="Medicare Stars and AI in five minutes"
        description="Enough context to make good decisions — not a lecture. Everything here is simulated and simplified."
      />
      <div className="grid grid-2">
        <Card title="How Stars work here">
          <ul className="prose" style={{ paddingLeft: 18, margin: 0 }}>
            <li>
              Each measure earns 1–5 Stars against game thresholds; the plan rating is a weighted
              average, rounded to the nearest half star.
            </li>
            <li>
              Outcome and adherence measures carry triple weight; patient experience and complaints
              carry double.
            </li>
            <li>
              <strong>Results lag.</strong> Operations move in the quarter, measures over following
              quarters, and the rating trails the measurement year.
            </li>
            <li>
              Crossing {r.target_stars.toFixed(1)} Stars earns a quality bonus — here an
              illustrative ${r.bonus_pmpy_usd.toLocaleString()} per member per year. The number is
              illustrative; the cliff is real.
            </li>
            <li>
              Round 2 capital is a {money(r.round2_base_musd)} base plus up to{' '}
              {money(r.round2_max_earned_musd)} earned with a 90-second board pitch scored on a
              15-point rubric.
            </li>
          </ul>
        </Card>
        <Card title="How you win">
          <p className="secondary" style={{ marginBottom: 10 }}>
            Sustainable value beats maximum Stars. Critical risk, member harm or concealment caps
            your score.
          </p>
          <table className="table table--compact">
            <tbody>
              {dimensions.map(([d, w, t]) => (
                <tr key={d}>
                  <td>
                    <div className="strong">{d}</div>
                    <div className="xs muted">{t}</div>
                  </td>
                  <td className="num strong">{w}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <Card title="Five AI capability classes" flush>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Executive meaning</th>
                <th>Examples in this simulation</th>
              </tr>
            </thead>
            <tbody>
              {CLASSES.map(([c, m, e]) => (
                <tr key={c}>
                  <td>
                    <Badge tone="accent">{c}</Badge>
                  </td>
                  <td>{m}</td>
                  <td className="secondary">{e}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="The 10 selected measures" flush>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Measure</th>
                <th>Leading indicators</th>
                <th className="num">Weight</th>
              </tr>
            </thead>
            <tbody>
              {catalog.measures.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className="code-chip">{m.code}</span>{' '}
                    <span className="strong">{m.name}</span>
                    <div className="xs muted">{m.lag_text}</div>
                  </td>
                  <td className="secondary">{m.leading_indicators.join(' · ')}</td>
                  <td className="num">×{m.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Glossary">
        <dl className="grid grid-2" style={{ margin: 0 }}>
          {glossary.map(([t, d]) => (
            <div key={t}>
              <dt className="strong">{t}</dt>
              <dd className="secondary small" style={{ margin: '2px 0 0' }}>
                {d}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card
        title="What this game simplifies"
        subtitle="The simplification register — the lessons transfer; the arithmetic does not"
        flush
      >
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Real-world concept</th>
                <th>In this game</th>
                <th>What to remember</th>
              </tr>
            </thead>
            <tbody>
              {catalog.simplifications.map((x) => (
                <tr key={x.actual}>
                  <td className="small">{x.actual}</td>
                  <td className="small secondary">{x.representation}</td>
                  <td className="small">“{x.disclosure}”</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Callout tone="neutral">
        {catalog.content_pack} · methodology baseline {catalog.methodology_baseline_date} · content
        v{catalog.content_version}. Thresholds and weights are game constructs pending Stars SME
        review. Held in reserve: {catalog.reserve_measures.join('; ')}.
      </Callout>
    </div>
  )
}
