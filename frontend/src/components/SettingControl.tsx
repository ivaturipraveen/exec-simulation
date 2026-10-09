import type { SettingView } from '../api/types'
import { Input, Select } from './ui/Field'

type Spec = Pick<SettingView, 'key' | 'kind' | 'options' | 'min' | 'max' | 'step' | 'label'>

/** The right control for a setting kind. Percent values are edited as 0–100 and stored as 0–1. */
export function SettingControl({
  spec,
  value,
  onChange,
  disabled,
}: {
  spec: Spec
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
}) {
  const id = `setting-${spec.key}`
  if (spec.kind === 'bool') {
    return (
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={Boolean(value)}
        aria-label={spec.label}
        className={`switch ${value ? 'is-on' : ''}`}
        disabled={disabled}
        onClick={() => onChange(!value)}
      >
        <span className="switch__thumb" />
      </button>
    )
  }
  if (spec.kind === 'enum') {
    return (
      <Select
        id={id}
        aria-label={spec.label}
        value={String(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {spec.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    )
  }
  if (spec.kind === 'text') {
    return (
      <Input
        id={id}
        aria-label={spec.label}
        value={String(value ?? '')}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }
  const percent = spec.kind === 'percent'
  const shown = percent ? Math.round(Number(value) * 1000) / 10 : Number(value)
  return (
    <div className="setting-number">
      {spec.kind === 'money' && <span className="setting-number__affix">$</span>}
      <Input
        id={id}
        aria-label={spec.label}
        type="number"
        inputMode="decimal"
        value={Number.isFinite(shown) ? shown : ''}
        min={percent ? (spec.min ?? 0) * 100 : (spec.min ?? undefined)}
        max={percent ? (spec.max ?? 1) * 100 : (spec.max ?? undefined)}
        step={percent ? 0.5 : (spec.step ?? undefined)}
        disabled={disabled}
        onChange={(e) => {
          const n = e.target.value === '' ? NaN : Number(e.target.value)
          onChange(percent ? n / 100 : spec.kind === 'int' ? Math.round(n) : n)
        }}
      />
      {(percent || spec.kind === 'money') && (
        <span className="setting-number__affix">{percent ? '%' : 'M'}</span>
      )}
    </div>
  )
}
