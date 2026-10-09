import type { MeasureView } from '../api/types'

/** 1–5 Stars. Higher-is-better: rate ≥ cut. Lower-is-better: rate < cut (Content Pack wording). */
export function measureStars(
  m: Pick<MeasureView, 'cut_points' | 'higher_is_better'>,
  rate: number,
): number {
  let stars = 1
  m.cut_points.forEach((cut, i) => {
    if (m.higher_is_better ? rate >= cut - 1e-9 : rate < cut - 1e-9) stars = i + 2
  })
  return stars
}
