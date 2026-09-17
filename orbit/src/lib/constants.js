// Group colours live in globals.css as --color-group-<id>. The canvas reads them with getComputedStyle on its own element.
export const GROUPS = [
  { id: 'partner', label: 'Partner' },
  { id: 'family', label: 'Family' },
  { id: 'friends', label: 'Friends' },
  { id: 'sjhc', label: 'SJHC' },
  { id: 'sjlc', label: 'SJLC' },
  { id: 'carrick', label: 'Carrick' },
  { id: 'school', label: 'School' },
  { id: 'other', label: 'Other' },
]
export const GROUP = Object.fromEntries(GROUPS.map((g) => [g.id, g]))
export const groupOf = (id) => GROUP[id] || GROUP.other

export const KINDS = [
  { id: 'Hangout', inPerson: true },
  { id: 'Ran into', inPerson: true },
  { id: 'Dinner', inPerson: true },
  { id: 'Hike', inPerson: true },
  { id: 'Gym', inPerson: true },
  { id: 'Party', inPerson: true },
  { id: 'Family event', inPerson: true },
  { id: 'Meeting', inPerson: true },
  { id: 'Work', inPerson: true },
  { id: 'Trip', inPerson: true },
  { id: 'Call', inPerson: false },
  { id: 'Text', inPerson: false },
  { id: 'Conversation', inPerson: false },
  { id: 'Note', inPerson: false },
]
const IN_PERSON = new Set(KINDS.filter((k) => k.inPerson).map((k) => k.id))
export const isInPerson = (kind) => IN_PERSON.has(kind)
export const isRemote = (kind) => kind === 'Call' || kind === 'Text' || kind === 'Conversation'
/** What counts toward rings and drift: time together, calls, texts and conversations. Notes don't. */
export const isContact = (kind) => isInPerson(kind) || isRemote(kind)
/** Closeness points per contact (DR-096): hangout 3, call 2, text thread or conversation 1. */
export const contactWeight = (kind) => (isInPerson(kind) ? 3 : kind === 'Call' ? 2 : isRemote(kind) ? 1 : 0)
/** Ring cut-offs in points: 12 in 90 days, 6 in 90 days, 6 in a year (4, 2 and 2 hangouts). */
export const RING_POINTS = { inner: 12, close: 6, regular: 6 }

export const RINGS = ['Inner circle', 'Close', 'Regular', 'Orbit', 'Not logged']
export const CADENCE = [21, 45, 120, 365, null]
export const RING_RADII = [0.24, 0.42, 0.6, 0.78, 0.95]

export const TOPICS = [
  { id: 'family', label: 'Family' },
  { id: 'work', label: 'Work' },
  { id: 'school', label: 'School' },
  { id: 'home', label: 'Home & living' },
  { id: 'interests', label: 'Interests' },
  { id: 'other', label: 'Other' },
]
