import { useEffect, useState } from 'react'
import { useOrbit } from '../../state/OrbitContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import ConfirmModal from '../ui/ConfirmModal.jsx'

/** Confirm removal and say exactly what else changes. */
export default function RemovePersonModal({ id, onClose }) {
  const { people, deletePerson, storage } = useOrbit()
  const { notify, home } = useUI()
  const [impact, setImpact] = useState(null)
  const p = people[id]

  useEffect(() => {
    storage.deletePersonImpact(id).then(setImpact, () => setImpact(null))
  }, [id, storage])

  if (!p) return null
  return (
    <ConfirmModal
      title={`Remove ${p.name}?`}
      confirmLabel="Remove"
      onClose={onClose}
      onConfirm={async () => {
        await deletePerson(id)
        notify(`Removed ${p.name}`)
        home()
      }}
      body={
        <>
          <p>Their facts, notes and plans are deleted. A backup copy stays in data/backups.</p>
          {impact && impact.events > 0 && (
            <p>
              They'll be taken off {impact.events} event{impact.events === 1 ? '' : 's'}
              {impact.removedEvents > 0 && `, and ${impact.removedEvents} event${impact.removedEvents === 1 ? '' : 's'} with only them will be deleted`}.
            </p>
          )}
        </>
      }
    />
  )
}
