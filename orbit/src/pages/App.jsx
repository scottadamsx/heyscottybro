import { matchPath, useLocation, useSearchParams } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { useOrbit } from '../state/OrbitContext.jsx'
import { useUI } from '../state/UIContext.jsx'
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
  const [params, setParams] = useSearchParams()
  const { open } = useUI()
  const consumedSource = useRef(null)
  useEffect(() => {
    const sourceHostEventId = params.get('sourceHostEventId')
    const sourceHostJournalId = params.get('sourceHostJournalId')
    const openLog = params.get('openLog') === '1'
    const openJournalReview = params.get('openJournalReview') === '1'
    const token = sourceHostEventId || (openJournalReview ? `journal:${sourceHostJournalId}` : openLog ? `reminder:${params.get('reminderId')}` : null)
    if (!token || consumedSource.current === token) return
    consumedSource.current = token
    if (openJournalReview && sourceHostJournalId) {
      const pending = window.__pendingOrbitJournalReview
      if (pending && String(pending.hostJournalId) === sourceHostJournalId && Date.now() - pending.queuedAt <= 120_000) {
        delete window.__pendingOrbitJournalReview
        open('journal', pending)
      }
    } else open('log', {
      ...(sourceHostEventId ? { sourceHostEventId } : {}),
      date: params.get('date') || undefined,
      title: params.get('title') || undefined,
      reminderId: params.get('reminderId') || undefined,
      occurrenceDate: params.get('occurrenceDate') || undefined,
    })
    const next = new URLSearchParams(params)
    next.delete('sourceHostEventId'); next.delete('title'); next.delete('date'); next.delete('openLog')
    next.delete('sourceHostJournalId'); next.delete('openJournalReview')
    setParams(next, { replace: true })
  }, [params, setParams, open])
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
