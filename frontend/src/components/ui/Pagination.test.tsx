import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { pageList } from '../../lib/pagination'
import { Pagination } from './Pagination'

describe('pageList', () => {
  it('lists every page when there are few', () => {
    expect(pageList(2, 5)).toEqual([1, 2, 3, 4, 5])
  })
  it('keeps the ends and the neighbours of the current page', () => {
    expect(pageList(6, 12)).toEqual([1, '…', 5, 6, 7, '…', 12])
    expect(pageList(1, 12)).toEqual([1, 2, '…', 12])
  })
})

describe('Pagination', () => {
  it('shows the range and moves between pages', () => {
    const onChange = vi.fn()
    render(<Pagination page={1} pageSize={8} total={37} onChange={onChange} />)
    expect(screen.getByText('Showing 1–8 of 37')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Page 5' }))
    expect(onChange.mock.calls).toEqual([[2], [5]])
  })
  it('renders nothing when everything fits on one page', () => {
    const { container } = render(<Pagination page={1} pageSize={8} total={8} onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
