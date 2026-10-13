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
  const money = spec.kind === 'money'
  const shown = percent ? Math.round(Number(value) * 1000) / 10 : Number(value)
  // Shown units: percent is edited as 0–100, everything else as stored.
  const lo = percent ? (spec.min ?? 0) * 100 : (spec.min ?? undefined)
  const hi = percent ? (spec.max ?? 1) * 100 : (spec.max ?? undefined)
  const step = percent ? 1 : (spec.step ?? (spec.kind === 'int' ? 1 : money ? 0.5 : 0.1))
  const emit = (n: number) => onChange(percent ? n / 100 : spec.kind === 'int' ? Math.round(n) : n)
  const nudge = (dir: 1 | -1) => {
    const base = Number.isFinite(shown) ? shown : (lo ?? 0)
    let next = Math.round((base + dir * step) * 1000) / 1000
    if (lo != null) next = Math.max(lo, next)
    if (hi != null) next = Math.min(hi, next)
    emit(next)
  }
  const atMin = lo != null && Number.isFinite(shown) && shown <= lo
  const atMax = hi != null && Number.isFinite(shown) && shown >= hi
  return (
    <div className={`num-field ${disabled ? 'is-disabled' : ''}`}>
      <button
        type="button"
        className="num-field__step"
        onClick={() => nudge(-1)}
        disabled={disabled || atMin}
        aria-label={`Decrease ${spec.label}`}
        tabIndex={-1}
      >
        −
      </button>
      <label className="num-field__box" htmlFor={id}>
        {money && <span className="num-field__affix">$</span>}
        <input
          id={id}
          className="num-field__input"
          aria-label={spec.label}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(shown) ? shown : ''}
          // Sized to the value so the unit sits right next to it.
          style={{
            width: `${Math.max(2, String(Number.isFinite(shown) ? shown : '').length) + 1}ch`,
          }}
          min={lo}
          max={hi}
          step={percent ? 0.5 : (spec.step ?? 'any')}
          disabled={disabled}
          onChange={(e) => emit(e.target.value === '' ? NaN : Number(e.target.value))}
        />
        {(percent || money) && <span className="num-field__affix">{percent ? '%' : 'M'}</span>}
      </label>
      <button
        type="button"
        className="num-field__step"
        onClick={() => nudge(1)}
        disabled={disabled || atMax}
        aria-label={`Increase ${spec.label}`}
        tabIndex={-1}
      >
        +
      </button>
    </div>
  )
}
