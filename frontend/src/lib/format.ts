export const money = (musd: number, digits = 1) => `$${musd.toFixed(digits)}M`
export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`
export const signed = (x: number, digits = 1) => `${x > 0 ? '+' : ''}${x.toFixed(digits)}`
export const stars = (x: number) => x.toFixed(1)

export function clockText(seconds: number): string {
  const neg = seconds < 0
  const s = Math.abs(Math.round(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${neg ? '+' : ''}${m}:${r.toString().padStart(2, '0')}`
}

/** Format a measure value by its unit kind ('percent' | 'score' | 'rate'). */
export function measureValue(value: number, unitKind: string): string {
  if (unitKind === 'rate' && Math.abs(value) < 2) return value.toFixed(2)
  return value.toFixed(1)
}

export function measureDelta(delta: number, unitKind: string): string {
  const digits = unitKind === 'rate' && Math.abs(delta) < 2 ? 2 : 1
  return `${delta > 0 ? '+' : ''}${delta.toFixed(digits)}`
}

export const kpiValue = (value: number, unit: string) =>
  unit === '%'
    ? `${value.toFixed(0)}%`
    : unit === 'days'
      ? `${value.toFixed(1)} d`
      : value.toFixed(1)

export const titleCase = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export const DOMAIN_LABELS: Record<string, string> = {
  stars_quality: 'Stars & quality',
  members: 'Members',
  pharmacy: 'Pharmacy',
  experience: 'Experience & service',
  providers: 'Providers',
  technology: 'Technology & data',
  finance: 'Finance & operations',
  risk: 'Risk & governance',
}

export const DEPARTMENT_LABELS = DOMAIN_LABELS

export const FORMAT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  table: 'Table',
  log: 'Log',
  memo: 'Memo',
  survey: 'Survey',
  model_card: 'Model card',
  audit: 'Audit',
  deck: 'Deck',
  contract: 'Contract',
}

export const LEVEL_TONE: Record<string, 'good' | 'warning' | 'neutral'> = {
  high: 'good',
  medium: 'neutral',
  low: 'warning',
}
