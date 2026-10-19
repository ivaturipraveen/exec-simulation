import { Bot, HeartPulse, LayoutDashboard, ShieldCheck, TrendingUp } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { iconForTitle } from './cardIcons'

describe('iconForTitle', () => {
  it('gives each scorecard dimension its own icon', () => {
    expect(iconForTitle('Stars trajectory')).toBe(TrendingUp)
    expect(iconForTitle('Member outcomes and experience')).toBe(HeartPulse)
    expect(iconForTitle('AI transformation maturity')).toBe(Bot)
    expect(iconForTitle('Risk and governance')).toBe(ShieldCheck)
  })
  it('falls back to a neutral icon for unknown titles', () => {
    expect(iconForTitle('Something unrelated')).toBe(LayoutDashboard)
  })
})
