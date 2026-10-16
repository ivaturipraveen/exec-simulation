import { type ComponentProps, useId, type InputHTMLAttributes, type ReactNode } from 'react'

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: (id: string) => ReactNode
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId()
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {hint && !error && <div className="field__hint">{hint}</div>}
      {children(id)}
      {error && <div className="field__error">{error}</div>}
    </div>
  )
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={`input ${p.className ?? ''}`} />
)
export const Textarea = (p: ComponentProps<'textarea'>) => (
  <textarea {...p} className={`textarea ${p.className ?? ''}`} />
)
export { Select } from './Select'

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  block,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  label: string
  /** Full-width row of equal rectangular options, for form fields. */
  block?: boolean
}) {
  return (
    <div className={`segmented ${block ? 'segmented--block' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
