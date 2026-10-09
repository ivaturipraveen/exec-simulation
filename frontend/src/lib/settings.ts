import type { SettingView } from '../api/types'

/** Displays a setting value in its natural unit (percent and money read as people expect). */
export function formatSetting(spec: Pick<SettingView, 'kind'>, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (spec.kind === 'bool') return value ? 'On' : 'Off'
  if (spec.kind === 'percent') return `${Math.round(Number(value) * 1000) / 10}%`
  if (spec.kind === 'money') return `$${Number(value).toFixed(1)}M`
  return String(value)
}
