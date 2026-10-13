import { EyeOff, FileText } from 'lucide-react'
import { useAnswerKey } from '../api/hooks'
import type { SessionView } from '../api/types'
import { SectionTabs } from '../components/SectionTabs'
import { Callout, Loading } from '../components/ui/primitives'
import { payerSuffix } from '../lib/format'

const list = (x: unknown) => (Array.isArray(x) ? (x as string[]) : [])
/** "C-03 Quality initiative log" → "C-03" (the full title shows on hover). */
const docId = (a: string) => a.split(' ')[0]

export function AnswerKeyPanel({ session, token }: { session: SessionView; token: string }) {
  const { data } = useAnswerKey(session.id, token)
  if (!data) return <Loading />
  return (
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <Callout tone="warning" title="Facilitator only">
        <span className="row">
          <EyeOff size={14} aria-hidden /> Never project this screen. Teams discover these through
          evidence; reveal them in the debrief.
        </span>
      </Callout>
      <SectionTabs
        label="Teams"
        sections={data.map((t) => {
          const team = session.teams.find((x) => x.team_id === t.team_id)
          return {
            id: t.team_id,
            label: t.team_name,
            content: (
              <section className="card tp" aria-label={t.team_name}>
                <header className="tp__head">
                  <div className="grow">
                    <div className="tp__name">{t.team_name}</div>
                    <div className="tp__payer">
                      {payerSuffix(t.team_name, t.payer_name) ? `${t.payer_name} · ` : ''}
                      Signature trap: {t.trap_title}
                    </div>
                  </div>
                </header>

                <div className="tp__stats">
                  <div>
                    <span className="tp__stat-label">Root causes</span>
                    <span className="tp__stat-value num">
                      {team ? `${team.root_causes_cited}/${team.root_causes_total}` : '—'}
                    </span>
                    <span className="tp__stat-sub">evidenced in Diagnose</span>
                  </div>
                  <div>
                    <span className="tp__stat-label">Misleading signals</span>
                    <span className="tp__stat-value num">{t.misleading_signals.length}</span>
                    <span className="tp__stat-sub">in the data room</span>
                  </div>
                  <div>
                    <span className="tp__stat-label">Viable strategies</span>
                    <span className="tp__stat-value num">{t.viable_strategies.length}</span>
                    <span className="tp__stat-sub">paths that work</span>
                  </div>
                  <div>
                    <span className="tp__stat-label">Failure modes</span>
                    <span className="tp__stat-value num">{t.failure_modes.length}</span>
                    <span className="tp__stat-sub">common traps</span>
                  </div>
                </div>

                <div className="sec">
                  <h3 className="sec__label">
                    Hidden root causes{' '}
                    <span className="ss-tab__count">{t.hidden_root_causes.length}</span>
                  </h3>
                  <div className="ak-grid ak-grid--3">
                    {t.hidden_root_causes.map((rc) => (
                      <article key={String(rc.id)} className="ak-card ak-card--root">
                        <header className="ak-card__head">
                          <span className="code-chip code-chip--strong">{String(rc.id)}</span>
                          <h4 className="ak-card__title">{String(rc.title)}</h4>
                        </header>
                        <p className="ak-card__text">{String(rc.description)}</p>
                        <div className="ak-clue">
                          <span className="ak-clue__label">Review clue</span>
                          {String(rc.clue)}
                        </div>
                        <footer className="ak-card__foot">
                          <div>
                            <span className="ak-foot__label">
                              Evidence · {list(rc.evidence).length} documents
                            </span>
                            <div className="ak-chips">
                              {list(rc.evidence).map((a) => (
                                <span key={a} className="ak-chip" title={a}>
                                  <FileText aria-hidden /> {docId(a)}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="ak-foot__label">Addressed by</span>
                            <div className="ak-chips">
                              {list(rc.addressed_by).map((c) => (
                                <span key={c} className="ak-chip ak-chip--card">
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        </footer>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="sec">
                  <h3 className="sec__label">
                    Misleading signals{' '}
                    <span className="ss-tab__count">{t.misleading_signals.length}</span>
                  </h3>
                  <div className="ak-grid ak-grid--2">
                    {t.misleading_signals.map((m) => (
                      <article key={String(m.id)} className="ak-card ak-card--warn">
                        <header className="ak-card__head">
                          <span className="code-chip">{String(m.id)}</span>
                          <h4 className="ak-card__title">{String(m.title)}</h4>
                        </header>
                        <p className="ak-card__text">{String(m.why_misleading)}</p>
                        <footer className="ak-card__foot">
                          <div className="ak-chips">
                            {list(m.evidence).map((a) => (
                              <span key={a} className="ak-chip" title={a}>
                                <FileText aria-hidden /> {docId(a)}
                              </span>
                            ))}
                          </div>
                        </footer>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="ak-trap">
                  <span className="ak-trap__label">Signature trap</span>
                  <h4 className="ak-trap__title">{t.trap_title}</h4>
                  <p>{t.trap_description}</p>
                </div>

                <div className="sec">
                  <h3 className="sec__label">
                    Viable strategies{' '}
                    <span className="ss-tab__count">{t.viable_strategies.length}</span>
                  </h3>
                  <ul className="list-reset ak-rows ak-rows--good">
                    {t.viable_strategies.map((v) => (
                      <li key={String(v.title)}>
                        <span className="ak-rows__title">{String(v.title)}</span>
                        <p className="ak-rows__text">{String(v.description)}</p>
                        <div className="ak-chips ak-rows__chips">
                          {list(v.cards).map((c) => (
                            <span key={c} className="ak-chip ak-chip--card">
                              {c}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="sec">
                  <h3 className="sec__label">
                    Failure modes <span className="ss-tab__count">{t.failure_modes.length}</span>
                  </h3>
                  <ul className="list-reset ak-rows ak-rows--bad">
                    {t.failure_modes.map((fm) => (
                      <li key={String(fm.title)}>
                        <span className="ak-rows__title">{String(fm.title)}</span>
                        <p className="ak-rows__text">{String(fm.description)}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ),
          }
        })}
      />
    </div>
  )
}
