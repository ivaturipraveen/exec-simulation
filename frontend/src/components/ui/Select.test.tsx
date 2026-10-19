import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Select } from './Select'

function Harness({ onPick }: { onPick: (v: string) => void }) {
  const [v, setV] = useState('b')
  return (
    <Select
      aria-label="Letter"
      value={v}
      onChange={(e) => {
        setV(e.target.value)
        onPick(e.target.value)
      }}
    >
      <option value="a">Alpha</option>
      <>
        <option value="b">Bravo</option>
        {['c'].map((k) => (
          <option key={k} value={k}>
            {k === 'c' ? '★ ' : ''}Charlie
          </option>
        ))}
      </>
      <option value="d" disabled>
        Delta
      </option>
    </Select>
  )
}

describe('Select', () => {
  it('shows the selected option and opens a list of all options', () => {
    render(<Harness onPick={() => {}} />)
    const box = screen.getByRole('combobox', { name: 'Letter' })
    expect(box).toHaveTextContent('Bravo')
    fireEvent.click(box)
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Alpha',
      'Bravo',
      '★ Charlie',
      'Delta',
    ])
  })

  it('reports the chosen value like a native select and closes', () => {
    const onPick = vi.fn()
    render(<Harness onPick={onPick} />)
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: 'Alpha' }))
    expect(onPick).toHaveBeenCalledWith('a')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByRole('combobox')).toHaveTextContent('Alpha')
  })

  it('works from the keyboard and skips disabled options', () => {
    const onPick = vi.fn()
    render(<Harness onPick={onPick} />)
    const box = screen.getByRole('combobox')
    fireEvent.keyDown(box, { key: 'ArrowDown' }) // opens on Bravo
    fireEvent.keyDown(box, { key: 'ArrowDown' }) // Charlie
    fireEvent.keyDown(box, { key: 'ArrowDown' }) // Delta is disabled: stays on Charlie
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith('c')
  })

  it('closes on Escape without letting it reach a surrounding dialog', () => {
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    render(<Harness onPick={() => {}} />)
    const box = screen.getByRole('combobox')
    fireEvent.click(box)
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(outer).not.toHaveBeenCalled()
    document.removeEventListener('keydown', outer)
  })
})
