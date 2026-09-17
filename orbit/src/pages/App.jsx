import { matchPath, useLocation } from 'react-router-dom'
import { useOrbit } from '../state/OrbitContext.jsx'
import Header from '../components/Header.jsx'
import Sidebar from '../components/Sidebar.jsx'
import MapCard from '../components/MapCard.jsx'
import ViewsCard from '../components/views/ViewsCard.jsx'
import PersonDrawer from '../components/person/PersonDrawer.jsx'
import EventModal from '../components/EventModal.jsx'
import PageDrawer, { PAGES } from '../components/pages/PageDrawer.jsx'
import ModalHost from '../components/ModalHost.jsx'
import Toasts from '../components/Toasts.jsx'
import Button from '../components/ui/Button.jsx'
import { isEmbedded } from '../lib/runtime.js'

/** Deep links open a drawer or modal over the same screen. */
function RoutedLayer() {
  const { pathname } = useLocation()
  const person = matchPath('/person/:id', pathname)
  if (person) return <PersonDrawer key={person.params.id} id={person.params.id} />
  const event = matchPath('/event/:id', pathname)
  if (event) return <EventModal key={event.params.id} id={event.params.id} />
  const page = pathname.replace(/^\//, '')
  if (PAGES[page]) return <PageDrawer page={page} />
  return null
}

export default function App() {
  const { loadState, reload, saveError, clearSaveError } = useOrbit()

  if (loadState === 'loading') return <div className="boot">Loading your orbit…</div>
  if (loadState === 'error') {
    return (
      <div className="boot">
        {isEmbedded() ? (
          <p>Couldn’t load your people. Check your connection, then try again.</p>
        ) : (
          <p>
            Couldn’t reach the data server. Is <code>npm run dev</code> running?
          </p>
        )}
        <Button variant="primary" onClick={reload}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="app">
      <Header />
      {saveError && (
        <div className="banner banner-danger" role="alert">
          <span>Not saved: {saveError}. Your last change was undone.</span>
          <Button size="sm" onClick={clearSaveError}>
            Dismiss
          </Button>
        </div>
      )}
      <div className="layout">
        <main className="main">
          <MapCard />
          <ViewsCard />
        </main>
        <Sidebar />
      </div>
      <RoutedLayer />
      <ModalHost />
      <Toasts />
    </div>
  )
}
