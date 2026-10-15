import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react'
import type { ThHTMLAttributes } from 'react'

export type SortDir = 'asc' | 'desc'

interface SortableThProps extends Omit<ThHTMLAttributes<HTMLTableCellElement>, 'onClick'> {
  label: string
  /** This column is the one the table is sorted by. */
  active: boolean
  dir: SortDir
  onSort: () => void
}

/** A table header cell that sorts its column: chevrons show the direction, `aria-sort` tells assistive tech. */
export function SortableTh({ label, active, dir, onSort, className, ...rest }: SortableThProps) {
  const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ChevronUp : ChevronDown
  return (
    <th
      {...rest}
      className={className}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" className={`th-sort${active ? ' is-active' : ''}`} onClick={onSort}>
        {label}
        <Icon aria-hidden />
      </button>
    </th>
  )
}
