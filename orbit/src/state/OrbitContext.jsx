import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { storage } from '../lib/storage/adapter.js'
import { today } from '../lib/dates.js'
import { pickAi } from '../lib/ai/adapter.js'
import { answerJournalEntry, createJournalEntry, mergeJournalEntries } from '../lib/journalClient.js'

const OrbitContext = createContext(null)

/** Put one record back the way it was (or remove it if it didn't exist). */
const restore = (id, old) => (map) => {
  const { [id]: _, ...rest } = map
  return old === undefined ? rest : { ...rest, [id]: old }
}

export function OrbitProvider({ children }) {
  const [people, setPeople] = useState({})
  const [events, setEvents] = useState({})
  const [settings, setSettings] = useState(null)
  const [loadState, setLoadState] = useState('loading') // loading | ready | error
  const [sync, setSync] = useState('saved')
  const [saveError, setSaveError] = useState(null)
  const [asOf, setAsOf] = useState(null) // null = today (time travel off)
  const [health, setHealth] = useState(null)
  const [journals, setJournals] = useState({})
  const [journalState, setJournalState] = useState('idle')
  const [journalError, setJournalError] = useState('')
  const peopleRef = useRef(people)
  const eventsRef = useRef(events)
  const settingsRef = useRef(settings)
  peopleRef.current = people
  eventsRef.current = events
  settingsRef.current = settings

  const refreshHealth = useCallback(async () => {
    try {
      setHealth(await storage.health())
    } catch (err) {
      console.warn('[orbit] health check failed:', err.message)
      setHealth(null)
    }
  }, [])

  const reload = useCallback(async () => {
    try {
      const [p, e, s] = await Promise.all([storage.listPeople(), storage.listEvents(), storage.getSettings()])
      setPeople(p)
      setEvents(e)
      setSettings(s)
      setLoadState('ready')
      refreshHealth()
    } catch (err) {
      console.error(err)
      setLoadState('error')
    }
  }, [refreshHealth])

  useEffect(() => {
    reload()
    return storage.subscribeStatus(setSync)
  }, [reload])

  const reloadJournals = useCallback(async () => {
    setJournalState('loading')
    try {
      const out = await storage.listJournals()
      setJournals((current) => mergeJournalEntries(out.entries, current))
      setJournalError('')
      setJournalState('ready')
      return out.entries
    } catch (err) {
      setJournalError(err.message)
      setJournalState('error')
      throw err
    }
  }, [])

  useEffect(() => {
    if (health?.journal?.available) reloadJournals().catch(() => {})
    else if (health) setJournalState('unavailable')
  }, [health?.journal?.available, reloadJournals])

  const upsertJournal = useCallback((entry) => {
    setJournals((current) => ({ ...current, [entry.id]: entry }))
  }, [])

  const sendJournal = useCallback(async (text, id, context, onPersist) => {
    try {
      const entry = await createJournalEntry(text, { storage, ai: pickAi(health?.ai), id, context, onEntry: (saved) => {
        upsertJournal(saved)
        onPersist?.(saved)
      } })
      if (entry.status === 'saved') await reload()
      return entry
    } catch (err) {
      await reloadJournals().catch(() => {})
      throw err
    }
  }, [health?.ai, upsertJournal, reload, reloadJournals])

  const answerJournal = useCallback(async (entry, answers, onPersist) => {
    try {
      const result = await answerJournalEntry(entry, answers, { storage, ai: pickAi(health?.ai), onEntry: (saved) => {
        upsertJournal(saved)
        onPersist?.(saved)
      } })
      if (result.status === 'saved') await reload()
      return result
    } catch (err) {
      await reloadJournals().catch(() => {})
      throw err
    }
  }, [health?.ai, upsertJournal, reload, reloadJournals])

  const retryJournal = useCallback(async (entry) => {
    try {
      const result = await pickAi(health?.ai).journal(entry.id, entry.revision)
      upsertJournal(result.entry)
      if (result.entry.status === 'saved') await reload()
      return result.entry
    } catch (err) {
      await reloadJournals().catch(() => {})
      throw err
    }
  }, [health?.ai, upsertJournal, reload, reloadJournals])

  const undoJournal = useCallback(async (entry) => {
    try {
      const result = await storage.undoJournal(entry.id, entry.revision)
      upsertJournal(result.entry)
      await reload()
      return result.entry
    } catch (err) {
      await reloadJournals().catch(() => {})
      throw err
    }
  }, [upsertJournal, reload, reloadJournals])

  // The UI updates first, then the write. A rejected write puts the old value back and reports why,
  // so nothing looks saved when it isn't. Duplicate rejections are rethrown for the modal to handle.
  const guarded = useCallback(async (apply, revert, write) => {
    apply()
    try {
      const out = await write()
      setSaveError(null)
      return out
    } catch (err) {
      revert()
      console.warn('[orbit] save rejected:', err.code, err.message)
      if (err.code !== 'duplicate') setSaveError(err.message)
      throw err
    }
  }, [])

  const savePerson = useCallback(
    (id, doc, opts) => {
      const old = peopleRef.current[id]
      return guarded(
        () => setPeople((prev) => ({ ...prev, [id]: doc })),
        () => setPeople(restore(id, old)),
        () => storage.savePerson(id, doc, opts),
      )
    },
    [guarded],
  )

  const deletePerson = useCallback(
    async (id) => {
      const old = peopleRef.current[id]
      await guarded(
        () => setPeople(({ [id]: _, ...rest }) => rest),
        () => setPeople(restore(id, old)),
        () => storage.deletePerson(id),
      )
      // The server also edited their events; take its copy.
      setEvents(await storage.listEvents())
    },
    [guarded],
  )

  const saveEvent = useCallback(
    (id, doc, opts) => {
      const old = eventsRef.current[id]
      return guarded(
        () => setEvents((prev) => ({ ...prev, [id]: doc })),
        () => setEvents(restore(id, old)),
        () => storage.saveEvent(id, doc, opts),
      )
    },
    [guarded],
  )

  const deleteEvent = useCallback(
    (id) => {
      const old = eventsRef.current[id]
      return guarded(
        () => setEvents(({ [id]: _, ...rest }) => rest),
        () => setEvents(restore(id, old)),
        () => storage.deleteEvent(id),
      )
    },
    [guarded],
  )

  const saveSettings = useCallback(
    (doc) => {
      const before = settingsRef.current
      return guarded(
        () => setSettings(doc),
        () => setSettings(before),
        () => storage.saveSettings(doc),
      )
    },
    [guarded],
  )

  const setAiEnabled = useCallback(
    async (enabled) => {
      await saveSettings({ ...settingsRef.current, ai: { ...settingsRef.current?.ai, enabled } })
      await refreshHealth()
    },
    [saveSettings, refreshHealth],
  )

  // Merges touch several records on the server, so take its copy afterwards.
  const merge = useCallback(
    async (kind, keep, drop) => {
      try {
        await (kind === 'people' ? storage.mergePeople(keep, drop) : storage.mergeEvents(keep, drop))
        setSaveError(null)
      } catch (err) {
        setSaveError(err.message)
        throw err
      } finally {
        await reload()
      }
    },
    [reload],
  )

  const value = useMemo(
    () => ({
      people,
      events,
      settings,
      loadState,
      sync,
      saveError,
      clearSaveError: () => setSaveError(null),
      asOf: asOf || today(),
      timeTravelling: asOf != null && asOf !== today(),
      setAsOf,
      reload,
      savePerson,
      deletePerson,
      saveEvent,
      deleteEvent,
      saveSettings,
      setAiEnabled,
      merge,
      health,
      refreshHealth,
      ai: pickAi(health?.ai),
      journals,
      journalState,
      journalError,
      reloadJournals,
      sendJournal,
      answerJournal,
      retryJournal,
      undoJournal,
      /** Latest state, for callbacks that run later (Undo). */
      peek: () => ({ people: peopleRef.current, events: eventsRef.current, settings: settingsRef.current }),
      storage,
    }),
    [people, events, settings, loadState, sync, saveError, asOf, health, journals, journalState, journalError, reloadJournals, sendJournal, answerJournal, retryJournal, undoJournal, reload, refreshHealth, savePerson, deletePerson, saveEvent, deleteEvent, saveSettings, setAiEnabled, merge],
  )

  return <OrbitContext.Provider value={value}>{children}</OrbitContext.Provider>
}

export function useOrbit() {
  const ctx = useContext(OrbitContext)
  if (!ctx) throw new Error('useOrbit must be used inside OrbitProvider')
  return ctx
}
