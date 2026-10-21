import { describe, expect, it } from 'vitest'
import type { TeamView } from '../api/types'
import { isShared, personKey, withConsent } from './consent'

const team = (consents: Record<string, unknown> = {}, consent?: unknown) =>
  ({ workspace: { consents, consent } }) as unknown as TeamView

describe('personKey', () => {
  it('ignores case and extra spaces, as the server does', () => {
    expect(personKey('  Sai   Teja ')).toBe('sai teja')
    expect(personKey('SAI TEJA')).toBe(personKey('sai teja'))
  })
})

describe('isShared', () => {
  it('reads the per-person map', () => {
    const t = team({ 'sai teja': { granted: true }, ravi: { granted: false } })
    expect(isShared(t.workspace, 'Sai  Teja')).toBe(true)
    expect(isShared(t.workspace, 'Ravi')).toBe(false)
  })
  it('is not shared for someone who has not answered once others have', () => {
    expect(isShared(team({ ravi: { granted: true } }).workspace, 'Sai')).toBe(false)
  })
  it('falls back to the old single consent only while the map is empty', () => {
    expect(isShared(team({}, { granted: true }).workspace, 'Sai')).toBe(true)
    expect(isShared(team({}, undefined).workspace, 'Sai')).toBe(false)
  })
})

describe('withConsent', () => {
  it('sets one person without touching the original or the others', () => {
    const before = team({ ravi: { granted: true, at: 't0', participant: 'Ravi' } })
    const after = withConsent(before, 'Sai Teja', true, 't1')
    expect(isShared(after.workspace, 'sai teja')).toBe(true)
    expect(isShared(after.workspace, 'Ravi')).toBe(true)
    expect(isShared(before.workspace, 'sai teja')).toBe(false)
    expect(after.workspace.consents['sai teja']).toMatchObject({ granted: true, at: 't1' })
  })
  it('can switch a person off again', () => {
    const on = withConsent(team(), 'Sai', true, 't1')
    expect(isShared(withConsent(on, 'Sai', false, 't2').workspace, 'Sai')).toBe(false)
  })
})
