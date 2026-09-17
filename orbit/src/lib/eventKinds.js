import { KINDS } from './constants.js'

export const KIND_GROUPS = [
  { label: 'In person', options: KINDS.filter((k) => k.inPerson).map((k) => ({ value: k.id, label: k.id })) },
  { label: 'Not in person', options: KINDS.filter((k) => !k.inPerson).map((k) => ({ value: k.id, label: k.id })) },
]

export const STATUS_OPTIONS = [
  { value: 'done', label: 'Done' },
  { value: 'planned', label: 'Planned' },
  { value: 'skipped', label: 'Skipped' },
]
