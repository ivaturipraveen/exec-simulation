export const money = (musd: number, digits = 1) => `$${musd.toFixed(digits)}M`
export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`
export const signed = (x: number, digits = 1) => `${x > 0 ? '+' : ''}${x.toFixed(digits)}`
export const stars = (x: number) => x.toFixed(1)

/** m:ss under an hour, h:mm:ss beyond, so a long overrun stays readable instead of "+3931:26". */
export function clockText(seconds: number): string {
  const neg = seconds < 0
  const s = Math.abs(Math.round(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  const sign = neg ? '+' : ''
  if (m < 60) return `${sign}${m}:${r.toString().padStart(2, '0')}`
  return `${sign}${Math.floor(m / 60)}:${(m % 60).toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`
}

/** "45 min" under an hour, "2h 5m" beyond. */
export function durationText(minutes: number): string {
  const m = Math.round(Math.abs(minutes))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`
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

/** The company a team plays, shown next to its name only when the facilitator gave it a custom name. */
export function payerSuffix(teamName: string, payerName: string): string {
  return teamName.trim() === payerName.trim() ? '' : payerName
}
