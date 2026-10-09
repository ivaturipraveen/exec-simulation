import { describe, expect, test } from 'vitest'
import { clockText, kpiValue, measureDelta, measureValue, money, pct, signed } from './format'
import { cardCost } from './cost'
import { measureStars } from './stars'

describe('format', () => {
  test('money, pct, signed', () => {
    expect(money(18)).toBe('$18.0M')
    expect(pct(0.654)).toBe('65%')
    expect(signed(2.5)).toBe('+2.5')
    expect(signed(-1)).toBe('-1.0')
  })
  test('clockText counts down and shows overtime', () => {
    expect(clockText(125)).toBe('2:05')
    expect(clockText(-30)).toBe('+0:30')
  })
  test('measure values by unit kind', () => {
    expect(measureValue(0.55, 'rate')).toBe('0.55')
    expect(measureValue(11.8, 'rate')).toBe('11.8')
    expect(measureValue(72, 'percent')).toBe('72.0')
    expect(measureDelta(-0.1, 'rate')).toBe('-0.10')
    expect(kpiValue(45, '%')).toBe('45%')
    expect(kpiValue(0.8, 'days')).toBe('0.8 d')
  })
})

describe('measureStars', () => {
  const higher = {
    cut_points: [57, 66, 73, 80] as [number, number, number, number],
    higher_is_better: true,
  }
  // M11 complaints (Content Pack): 5★ under 0.10, 4★ 0.10–0.24, 3★ 0.25–0.49, 2★ 0.50+, 1★ 0.80+
  const lower = {
    cut_points: [0.8, 0.5, 0.25, 0.1] as [number, number, number, number],
    higher_is_better: false,
  }
  test('higher is better', () => {
    expect(measureStars(higher, 50)).toBe(1)
    expect(measureStars(higher, 68)).toBe(3)
    expect(measureStars(higher, 80)).toBe(5)
  })
  test('lower is better uses strict thresholds (complaints)', () => {
    expect(measureStars(lower, 0.85)).toBe(1)
    expect(measureStars(lower, 0.55)).toBe(2)
    expect(measureStars(lower, 0.5)).toBe(2)
    expect(measureStars(lower, 0.25)).toBe(3)
    expect(measureStars(lower, 0.2)).toBe(4)
    expect(measureStars(lower, 0.09)).toBe(5)
  })
})

describe('cardCost', () => {
  const base = { scopes: [], cost_musd: 1.2, cost_basis: 'per_year' } as never
  test('per-year cards cost each remaining year; scopes override', () => {
    expect(cardCost(base, null, 2)).toBeCloseTo(2.4)
    expect(cardCost(base, null, 1)).toBeCloseTo(1.2)
    const scoped = {
      scopes: [
        { id: 'full', label: 'Full', cost_musd: 5 },
        { id: 'scoped', label: 'Scoped', cost_musd: 2.5 },
      ],
      cost_musd: 5,
      cost_basis: 'one_time',
    } as never
    expect(cardCost(scoped, 'scoped', 2)).toBe(2.5)
    expect(cardCost(scoped, null, 2)).toBe(5)
  })
})
