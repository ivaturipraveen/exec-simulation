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
  knownSessions(): string[] {
    try {
      return JSON.parse(storage.get('execsim.sessions') ?? '[]') as string[]
    } catch {
      return []
    }
  },
}

const ADMIN_KEY = 'execsim.admin'

/** Settings (admin) token lives only for the browser tab session. */
export const adminAuth = {
  get(): string | null {
    try {
      return window.sessionStorage.getItem(ADMIN_KEY)
    } catch {
      return null
    }
  },
  set(token: string): void {
    try {
      window.sessionStorage.setItem(ADMIN_KEY, token)
    } catch {
      /* ignore */
    }
  },
  clear(): void {
    try {
      window.sessionStorage.removeItem(ADMIN_KEY)
    } catch {
      /* ignore */
    }
  },
}
