import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Loading } from './components/ui/primitives'
import { Landing } from './pages/Landing'
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

export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route index element={<Landing />} />
        <Route path="team/*" element={<TeamApp />} />
        <Route path="facilitator/:sessionId/*" element={<FacilitatorConsole />} />
        <Route path="facilitator" element={<Navigate to="/" replace />} />
        <Route path="projector/:sessionId" element={<ProjectorView />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
