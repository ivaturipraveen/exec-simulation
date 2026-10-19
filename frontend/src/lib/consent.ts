import type { TeamView, Workspace } from '../api/types'

/** The key the server files a person's consent under: trimmed, single-spaced, lower-case. */
export const personKey = (name: string) => name.split(/\s+/).filter(Boolean).join(' ').toLowerCase()

/**
 * Is this person sharing their opportunities? Reads the per-person map; a session that only has the
 * old single `consent` (no map yet) answers with that.
 */
export function isShared(ws: Workspace, name: string): boolean {
  const consents = ws.consents ?? {}
  return (
    consents[personKey(name)]?.granted ??
    (Object.keys(consents).length === 0 && !!ws.consent?.granted)
  )
}

/** A copy of the team view with this person's consent set, to show before the server has answered. */
export function withConsent(
  team: TeamView,
  participant: string,
  granted: boolean,
  at: string,
): TeamView {
  const key = personKey(participant)
  const consents = team.workspace.consents ?? {}
  return {
    ...team,
    workspace: {
      ...team.workspace,
      consents: { ...consents, [key]: { ...consents[key], at, granted, participant } },
    },
  }
}
