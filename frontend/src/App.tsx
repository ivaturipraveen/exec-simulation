import { lazy, Suspense, useLayoutEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { SignInGate } from './components/SignInGate'
import { Loading } from './components/ui/primitives'
import { Landing } from './pages/Landing'
import { LoginPage } from './pages/LoginPage'
import { NotFound } from './pages/NotFound'

const TeamApp = lazy(() => import('./team/TeamApp').then((m) => ({ default: m.TeamApp })))
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const FacilitatorConsole = lazy(() =>
  import('./facilitator/FacilitatorConsole').then((m) => ({ default: m.FacilitatorConsole })),
)
const ProjectorView = lazy(() =>
  import('./facilitator/ProjectorView').then((m) => ({ default: m.ProjectorView })),
)

/** A new page starts at the top instead of inheriting the previous page's scroll position. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <ScrollToTop />
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route
          element={
            <SignInGate>
              <Outlet />
            </SignInGate>
          }
        >
          <Route index element={<Landing />} />
          <Route path="team/*" element={<TeamApp />} />
          <Route
            element={
              <SignInGate facilitatorOnly>
                <Outlet />
              </SignInGate>
            }
          >
            <Route path="facilitator/:sessionId/*" element={<FacilitatorConsole />} />
            <Route path="projector/:sessionId" element={<ProjectorView />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="facilitator" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
