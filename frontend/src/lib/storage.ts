/** Safe localStorage access: storage can be unavailable (private mode, blocked site data). */
export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      /* ignore */
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
}

const TEAM_KEY = 'execsim.team'
const FAC_PREFIX = 'execsim.facilitator.'

export interface TeamSession {
  token: string
  teamId: string
  sessionId: string
  teamName: string
  payerName: string
}

export const auth = {
  team(): TeamSession | null {
    const raw = storage.get(TEAM_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as TeamSession
    } catch {
      return null
    }
  },
  setTeam(team: TeamSession): void {
    storage.set(TEAM_KEY, JSON.stringify(team))
  },
  clearTeam(): void {
    storage.remove(TEAM_KEY)
  },
  facilitator(sessionId: string): string | null {
    return storage.get(FAC_PREFIX + sessionId)
  },
  setFacilitator(sessionId: string, token: string): void {
    storage.set(FAC_PREFIX + sessionId, token)
    const known = auth.knownSessions().filter((s) => s !== sessionId)
    storage.set('execsim.sessions', JSON.stringify([sessionId, ...known].slice(0, 10)))
  },
  clearFacilitator(sessionId: string): void {
    storage.remove(FAC_PREFIX + sessionId)
    const known = auth.knownSessions().filter((s) => s !== sessionId)
    storage.set('execsim.sessions', JSON.stringify(known))
  },
  knownSessions(): string[] {
    try {
      return JSON.parse(storage.get('execsim.sessions') ?? '[]') as string[]
    } catch {
      return []
    }
  },
}

const SIGN_IN_KEY = 'execsim.signin'

/** Site sign-in token (when the server requires sign-in). Kept until the user signs out. */
export const signIn = {
  get(): string | null {
    return storage.get(SIGN_IN_KEY)
  },
  set(token: string): void {
    storage.set(SIGN_IN_KEY, token)
  },
  clear(): void {
    storage.remove(SIGN_IN_KEY)
  },
}
