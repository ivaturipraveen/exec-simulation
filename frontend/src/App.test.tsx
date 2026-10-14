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

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

type Status = { required: boolean; signed_in: boolean; role?: 'facilitator' | 'team' }

/** Answers the sign-in calls; every other call gets `other` (or a network failure). */
function stubApi(auth: Status, other?: (url: string) => Response) {
  let status: Status = auth
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/auth/status')) return json(status)
      if (url.endsWith('/api/auth/login')) {
        const email = JSON.parse(String(init?.body)).email as string
        const role = email.startsWith('team') ? 'team' : 'facilitator'
        status = { required: true, signed_in: true, role }
        return json({ ...status, token: 'user.x.sig', email, payer_name: 'Horizon Health' })
      }
      if (other) return other(url)
      throw new TypeError('offline')
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  try {
    window.localStorage.removeItem('execsim.team')
    window.localStorage.removeItem('execsim.signin')
  } catch {
    /* storage unavailable */
  }
})

test('landing page offers join and facilitate', async () => {
  stubApi({ required: false, signed_in: true })
  renderAt('/')
  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/AI transformation/)
  expect(screen.getByRole('tab', { name: /Join your team/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  fireEvent.click(screen.getByRole('tab', { name: /Facilitate/ }))
  expect(screen.getByRole('button', { name: /Create session/ })).toBeInTheDocument()
})

test('invalid join code shows the server error message', async () => {
  stubApi({ required: false, signed_in: true }, () =>
    json({ error: { code: 'not_found', message: 'No team uses that join code' } }, 404),
  )
  renderAt('/')
  fireEvent.change(await screen.findByLabelText('Team join code'), { target: { value: 'zzzzzz' } })
  fireEvent.click(screen.getByRole('button', { name: /Enter workspace/ }))
  await waitFor(() => expect(screen.getByText('No team uses that join code')).toBeInTheDocument())
})

test('team route without a session redirects to the start page', async () => {
  stubApi({ required: false, signed_in: true })
  renderAt('/team')
  // /team loads the workspace bundle on demand before redirecting; allow for a slow first import.
  expect(await screen.findByRole('heading', { level: 1 }, { timeout: 10_000 })).toHaveTextContent(
    /AI transformation/,
  )
}, 20_000)

test('unknown route shows not found', async () => {
  stubApi({ required: false, signed_in: true })
  renderAt('/nope')
  expect(await screen.findByText('Page not found')).toBeInTheDocument()
})

test('when sign-in is required, visitors land on the sign-in page and enter after signing in', async () => {
  stubApi({ required: true, signed_in: false })
  renderAt('/')
  expect(await screen.findByRole('heading', { name: 'Player sign-in' })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'fac@brightcone.ai' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
  fireEvent.click(screen.getByRole('button', { name: /Start the simulation/ }))
  expect(await screen.findByRole('heading', { name: /Facilitate/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  expect(window.localStorage.getItem('execsim.signin')).toBe('user.x.sig')
})

test('a deep link waits behind sign-in', async () => {
  stubApi({ required: true, signed_in: false })
  renderAt('/settings')
  expect(await screen.findByRole('heading', { name: 'Player sign-in' })).toBeInTheDocument()
})

test('a team signs in, then must enter its own join code', async () => {
  stubApi({ required: true, signed_in: false }, () =>
    json(
      {
        error: {
          code: 'forbidden',
          message: "That join code is not for your team. Use your own team's join code.",
        },
      },
      403,
    ),
  )
  renderAt('/')
  fireEvent.change(await screen.findByLabelText('Email'), {
    target: { value: 'team@horizon.example' },
  })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
  fireEvent.click(screen.getByRole('button', { name: /Start the simulation/ }))
  const code = await screen.findByLabelText('Team join code')
  expect(screen.getByText('Horizon Health')).toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: /Facilitate/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
  fireEvent.change(code, { target: { value: 'WRONG1' } })
  fireEvent.click(screen.getByRole('button', { name: /Enter workspace/ }))
  expect(await screen.findByText(/not for your team/)).toBeInTheDocument()
})

test('the facilitator sees only session creation, with all session options', async () => {
  stubApi({ required: true, signed_in: true, role: 'facilitator' })
  renderAt('/')
  expect(await screen.findByRole('heading', { name: /Facilitate/ })).toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: /Join your team/ })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Team join code')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Round 2 capital')).toBeInTheDocument()
  expect(screen.getByLabelText('Mode')).toBeInTheDocument()
  expect(screen.getByLabelText('Scenario seed')).toBeInTheDocument()
})

test('team accounts cannot open facilitator pages', async () => {
  stubApi({ required: true, signed_in: true, role: 'team' })
  renderAt('/settings')
  expect(await screen.findByLabelText('Team join code')).toBeInTheDocument()
})
