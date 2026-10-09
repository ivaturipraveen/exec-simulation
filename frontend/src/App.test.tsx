import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { App } from './App'
import { ToastProvider } from './components/ui/Toast'

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  try {
    window.localStorage.removeItem('execsim.team')
  } catch {
    /* storage unavailable */
  }
})

test('landing page offers join and facilitate', () => {
  renderAt('/')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/AI transformation/)
  expect(screen.getByRole('tab', { name: /Join your team/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  fireEvent.click(screen.getByRole('tab', { name: /Facilitate/ }))
  expect(screen.getByRole('button', { name: /Create session/ })).toBeInTheDocument()
})

test('invalid join code shows the server error message', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            error: { code: 'not_found', message: 'No team uses that join code' },
          }),
          { status: 404 },
        ),
    ),
  )
  renderAt('/')
  fireEvent.change(screen.getByLabelText('Team join code'), { target: { value: 'zzzzzz' } })
  fireEvent.click(screen.getByRole('button', { name: /Enter workspace/ }))
  await waitFor(() => expect(screen.getByText('No team uses that join code')).toBeInTheDocument())
})

test('team route without a session redirects to the start page', async () => {
  renderAt('/team')
  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/AI transformation/)
})

test('unknown route shows not found', () => {
  renderAt('/nope')
  expect(screen.getByText('Page not found')).toBeInTheDocument()
})
