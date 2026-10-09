import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Empty } from '../components/ui/primitives'

export function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <Empty title="Page not found" icon={<Compass aria-hidden />}>
        <Link to="/">Back to the start page</Link>
      </Empty>
    </div>
  )
}
