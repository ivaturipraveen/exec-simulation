import { describe, expect, it } from 'vitest'
import { LIST_MARGIN, placeList } from './listPlacement'

describe('placeList', () => {
  it('sits under the field on a wide screen', () => {
    const p = placeList({ left: 299, width: 537 }, 1440)
    expect(p).toMatchObject({ left: 299, minWidth: 537 })
    expect(p.maxWidth).toBe(1440 - LIST_MARGIN - 299)
  })

  it('stops short of the right edge on a phone, so a long label wraps instead of touching it', () => {
    const p = placeList({ left: 35, width: 320 }, 390)
    expect(p.left + p.maxWidth).toBe(390 - LIST_MARGIN)
    expect(p.maxWidth).toBeLessThan(390 - 35)
  })

  it('never lets the field itself push the list off either side', () => {
    const p = placeList({ left: -20, width: 600 }, 390)
    expect(p.left).toBe(LIST_MARGIN)
    expect(p.minWidth).toBeLessThanOrEqual(390 - 2 * LIST_MARGIN)
    expect(p.left + p.minWidth).toBeLessThanOrEqual(390 - LIST_MARGIN)
  })

  it('keeps a field that starts near the right edge fully on screen', () => {
    const p = placeList({ left: 300, width: 200 }, 390)
    expect(p.left + p.minWidth).toBeLessThanOrEqual(390 - LIST_MARGIN)
  })
})
