import type { InvestmentView } from '../api/types'

/** Cost of funding a card now: a scope's cost, or the annual cost × years left for per-year cards. */
export function cardCost(
  inv: InvestmentView,
  scope: string | null | undefined,
  years: number,
): number {
  const chosen = inv.scopes.find((s) => s.id === scope) ?? inv.scopes[0]
  const base = chosen ? chosen.cost_musd : inv.cost_musd
  return inv.cost_basis === 'per_year' ? base * years : base
}
