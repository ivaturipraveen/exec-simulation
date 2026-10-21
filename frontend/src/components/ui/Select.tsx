import { Check } from 'lucide-react'
import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { placeList, type ListPlacement } from '../../lib/listPlacement'

interface Option {
  value: string
  label: string
  disabled: boolean
}

type Props = {
  value?: string | number
  /** Called with `{ target: { value } }`, so handlers written for a native select keep working. */
  onChange?: (e: { target: { value: string } }) => void
  disabled?: boolean
  id?: string
  className?: string
  style?: CSSProperties
  title?: string
  placeholder?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  /** `<option>` elements, as for a native select. */
  children?: ReactNode
}

const nodeText = (node: ReactNode): string => {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children)
  return ''
}

/** Reads `<option>` children (also inside fragments and arrays) into a plain list. */
function readOptions(children: ReactNode): Option[] {
  const out: Option[] = []
  const walk = (nodes: ReactNode) => {
    Children.forEach(nodes, (child) => {
      if (
        !isValidElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>(
          child,
        )
      )
        return
      if (child.type === Fragment) {
        walk(child.props.children)
      } else if (child.type === 'option') {
        const label = nodeText(child.props.children)
        out.push({
          value: String(child.props.value ?? label),
          label,
          disabled: !!child.props.disabled,
        })
      }
    })
  }
  walk(children)
  return out
}

const MAX_LIST = 280
const GAP = 4

/**
 * Drop-down that replaces the browser's native select list: same props as a `<select>`
 * (value, onChange, `<option>` children), with our own styled, keyboard-friendly list.
 * The list is rendered in a portal, so dialogs and scrolling tables never clip it.
 */
export function Select({
  value,
  onChange,
  disabled,
  id,
  className = '',
  style,
  title,
  placeholder,
  children,
  ...aria
}: Props) {
  const options = useMemo(() => readOptions(children), [children])
  const current = String(value ?? '')
  const selectedIndex = options.findIndex((o) => o.value === current)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [rect, setRect] = useState<ListPlacement & { top?: number; bottom?: number }>()
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const listId = useId()

  const place = useCallback(() => {
    const el = trigger.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    const wanted = Math.min(MAX_LIST, options.length * 36 + 12)
    const flip = below < wanted + GAP && r.top > below
    setRect({
      ...placeList(r, window.innerWidth),
      ...(flip ? { bottom: window.innerHeight - r.top + GAP } : { top: r.bottom + GAP }),
    })
  }, [options.length])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!trigger.current?.contains(t) && !list.current?.contains(t)) setOpen(false)
    }
    const onScroll = (e: Event) => {
      if (list.current?.contains(e.target as Node)) return
      place()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, place])

  // keep the highlighted option in view while arrowing through a long list
  useEffect(() => {
    if (!open) return
    const el = list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [open, active])

  const openList = () => {
    if (disabled) return
    setActive(Math.max(0, selectedIndex))
    setOpen(true)
  }
  const choose = (o: Option) => {
    if (o.disabled) return
    if (o.value !== current) onChange?.({ target: { value: o.value } })
    setOpen(false)
    trigger.current?.focus()
  }
  const move = (from: number, step: 1 | -1) => {
    for (let i = from + step; i >= 0 && i < options.length; i += step)
      if (!options[i].disabled) return i
    return from
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openList()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((a) => move(a, 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((a) => move(a, -1))
        break
      case 'Home':
        e.preventDefault()
        setActive(move(-1, 1))
        break
      case 'End':
        e.preventDefault()
        setActive(move(options.length, -1))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (options[active]) choose(options[active])
        break
      case 'Escape':
        // keep a surrounding dialog open: this Escape only closes the list
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        if (e.key.length === 1) {
          const k = e.key.toLowerCase()
          const hit = options.findIndex(
            (o, i) => i > active && !o.disabled && o.label.toLowerCase().startsWith(k),
          )
          const first = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(k))
          if (hit >= 0 || first >= 0) setActive(hit >= 0 ? hit : first)
        }
    }
  }

  const shown = selectedIndex >= 0 ? options[selectedIndex].label : (placeholder ?? '')
  return (
    <>
      <button
        ref={trigger}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={aria['aria-label']}
        aria-labelledby={aria['aria-labelledby']}
        disabled={disabled}
        title={title}
        style={style}
        className={`select select--custom ${open ? 'is-open' : ''} ${className}`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={`select__value ${shown ? '' : 'is-placeholder'}`}>{shown || ' '}</span>
      </button>
      {open &&
        rect &&
        createPortal(
          <ul
            ref={list}
            id={listId}
            role="listbox"
            className="select-list"
            style={{
              left: rect.left,
              minWidth: rect.minWidth,
              maxWidth: rect.maxWidth,
              top: rect.top,
              bottom: rect.bottom,
              maxHeight: MAX_LIST,
            }}
          >
            {options.map((o, i) => (
              <li
                key={`${o.value}-${i}`}
                id={`${listId}-${i}`}
                role="option"
                data-index={i}
                aria-selected={i === selectedIndex}
                aria-disabled={o.disabled || undefined}
                className={`select-list__opt ${i === active ? 'is-active' : ''} ${
                  i === selectedIndex ? 'is-selected' : ''
                }`}
                // keep focus on the trigger so the keyboard keeps working
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => !o.disabled && setActive(i)}
                onClick={() => choose(o)}
              >
                <span className="select-list__label">{o.label}</span>
                {i === selectedIndex && <Check size={14} aria-hidden />}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  )
}
