import { newId } from '../../src/lib/ids.js'
import { GROUPS, KINDS, TOPICS } from '../../src/lib/constants.js'
import { compareFact, contentTokens, findDuplicateEvent, normText } from '../../src/lib/dedupe.js'
import { isYMD } from '../../src/lib/validate.js'
import { journalQuestionId, matchJournalPerson, resolveJournalDate, validateJournalInput } from '../../src/lib/journal.js'
import * as store from '../store.js'
import * as repo from '../repo.js'
import { aiStatus, getClient, MODEL } from './config.js'
import { loadPrompt } from './prompts.js'

const fail = (code, message) => ({ ok: false, code, message })
const text = (s, max = 500) => typeof s === 'string' && s.trim().length > 0 && s.length <= max
const small = (s, max = 500) => typeof s === 'string' && s.length <= max
const object = (v) => v && typeof v === 'object' && !Array.isArray(v)
const kinds = new Set(KINDS.map((k) => k.id))
const topics = new Set(TOPICS.map((t) => t.id))
const needsAttribution = (f) => !normText(f.evidence).includes(normText(f.mention))
const hasPersonPronoun = (s) => /\b(he|him|his|hes|she|her|hers|shes|they|them|their|theirs|theyre)\b/.test(normText(s))
const isPronounName = (s) => /^(i|me|my|we|us|our|he|him|his|hes|she|her|hers|shes|they|them|their|theirs|theyre)$/.test(normText(s))

const EXTRACT_FORMAT = {
  type: 'json_schema',
  schema: {
    type: 'object', additionalProperties: false, required: ['event', 'facts'],
    properties: {
      event: { anyOf: [
        { type: 'null' },
        { type: 'object', additionalProperties: false, required: ['datePhrase', 'kind', 'people', 'place'], properties: {
          datePhrase: { type: 'string' }, kind: { type: 'string', enum: [...kinds] },
          people: { type: 'array', items: { type: 'string' } }, place: { type: 'string' },
        } },
      ] },
      facts: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['mention', 'k', 'v', 'topic', 'evidence', 'scope'], properties: {
          mention: { type: 'string' }, k: { type: 'string' }, v: { type: 'string' },
          topic: { type: 'string', enum: [...topics] }, evidence: { type: 'string' }, scope: { type: 'string', enum: ['profile', 'context'] },
        } } },
    },
  },
}
const RECONCILE_FORMAT = {
  type: 'json_schema',
  schema: { type: 'object', additionalProperties: false, required: ['decisions'], properties: {
    decisions: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['index', 'outcome'], properties: { index: { type: 'integer' }, outcome: { type: 'string', enum: ['add', 'already_known', 'uncertain', 'context'] },
        attribution: { type: 'string', enum: ['clear', 'ambiguous'] },
        known: { type: 'object', additionalProperties: false, required: ['field'], properties: {
          field: { type: 'string', enum: ['how', 'group', 'birthday', 'fact'] }, factIndex: { type: 'integer' },
        } },
      } } },
  } },
}

async function providerAsk({ pass, prompt, data }) {
  const response = await getClient().messages.create({
    model: MODEL, max_tokens: 4000, system: prompt.text,
    output_config: { effort: 'medium', format: pass === 'extract' ? EXTRACT_FORMAT : RECONCILE_FORMAT },
    messages: [{ role: 'user', content: JSON.stringify(data) }],
  }, { signal: AbortSignal.timeout(20000) })
  if (response.stop_reason === 'refusal') throw new Error('The model declined this entry.')
  return response.content.filter((part) => part.type === 'text').map((part) => part.text).join('')
}

function parse(value) {
  if (typeof value === 'string') {
    try { return JSON.parse(value) } catch { return null }
  }
  return value
}

function extractValid(value, source) {
  if (!object(value)) return 'response.object'
  if (!Array.isArray(value.facts) || value.facts.length > 24) return 'facts.array_limit'
  if (value.event !== null) {
    const e = value.event
    if (!object(e) || !small(e.datePhrase, 100) || !kinds.has(e.kind) || !small(e.place, 160) ||
        !Array.isArray(e.people) || e.people.length > 20) return 'event.shape_or_enum'
    if (e.people.some((n) => !text(n, 100) || !normText(source).includes(normText(n)))) return 'event.people.source_evidence'
    if (e.people.some(isPronounName)) return 'event.people.use_source_name_not_pronoun'
    if (e.datePhrase && !normText(source).includes(normText(e.datePhrase))) return 'event.datePhrase.source_evidence'
    if (e.place && !normText(source).includes(normText(e.place))) return 'event.place.source_evidence'
  }
  for (const [index, f] of value.facts.entries()) {
    const path = `facts[${index}]`
    if (!object(f) || !text(f.mention, 100) || !text(f.k, 80) || !text(f.v, 300) ||
        !topics.has(f.topic) || !text(f.evidence, 500) || !['profile', 'context'].includes(f.scope)) return `${path}.shape_or_enum`
    if (!normText(source).includes(normText(f.evidence))) return `${path}.evidence.not_verbatim`
    if (!normText(f.evidence).includes(normText(f.v))) return `${path}.value.not_in_evidence`
    if (isPronounName(f.mention)) return `${path}.mention.use_source_name_not_pronoun`
    if (needsAttribution(f) && (!hasPersonPronoun(f.evidence) || !normText(source).includes(normText(f.mention)))) return `${path}.mention.not_in_evidence`
    if (/\b(not|never|no longer|isnt|doesnt|didnt)\b/.test(normText(f.evidence)) &&
        !/\b(not|never|no longer|isnt|doesnt|didnt)\b/.test(normText(f.v))) return `${path}.negation.not_preserved`
  }
  return null
}

function reconcileValid(value, context) {
  if (!object(value) || !Array.isArray(value.decisions) || value.decisions.length !== context.length) return 'decisions.count'
  const seen = new Set()
  for (const d of value.decisions) {
    if (!object(d) || !Number.isInteger(d.index) || d.index < 0 || d.index >= context.length || seen.has(d.index) ||
        !['add', 'already_known', 'uncertain', 'context'].includes(d.outcome)) return 'decisions.index_or_outcome'
    if (needsAttribution(context[d.index].fact) && !['clear', 'ambiguous'].includes(d.attribution)) return 'decisions.attribution.required'
    if (d.known) {
      if (!object(d.known) || !['how', 'group', 'birthday', 'fact'].includes(d.known.field)) return 'decisions.known.field'
      const candidate = context[d.index]
      if (d.known.field === 'fact' && (!Number.isInteger(d.known.factIndex) || !candidate.existing[d.known.factIndex])) return 'decisions.known.factIndex'
      if (d.known.field !== 'fact' && !candidate.basics[d.known.field]) return 'decisions.known.missing_value'
    }
    seen.add(d.index)
  }
  return null
}

async function pass(ask, passName, data, validate) {
  const prompt = loadPrompt(`journal-${passName}`)
  const diagnosticId = newId('diagnostic')
  let rule
  for (let attempt = 0; attempt < 2; attempt++) {
    const output = parse(await ask({ pass: passName, prompt, data: { ...data,
      retry: attempt ? `Previous output failed validation at ${rule}. Correct that field using the supplied source and schema.` : undefined } }))
    rule = validate(output)
    if (!rule) return output
    console.warn('[journal] validation failed', { diagnosticId, pass: passName, rule, attempt: attempt + 1 })
  }
  throw Object.assign(new Error('The model response did not pass validation. Retry this entry.'), {
    validation: { diagnosticId, pass: passName, rule },
  })
}

function question(id, textValue, kind, options) {
  return { id, text: textValue, kind, ...(options ? { options } : {}) }
}

function personChoice(people, mention, answer) {
  const match = matchJournalPerson(people, mention)
  if (answer) {
    if (answer === `create:${mention}`) return { create: mention }
    if (people[answer]) return { id: answer }
    const byName = matchJournalPerson(people, answer)
    if (byName.id) return { id: byName.id }
    return { candidates: match.candidates }
  }
  if (match.id) return { id: match.id }
  return { candidates: match.candidates }
}

function safeProfileFact(f) {
  if (f.scope !== 'profile') return false
  const evidence = normText(f.evidence)
  if (/^(likes?|loves?|favorite|favourite|enjoys?)\b/i.test(f.k) && !/\b(likes?|loves?|favorite|favourite|enjoys?)\b/.test(evidence)) return false
  if (/\b(employer|job|works at|works for)\b/i.test(f.k) && !/\b(works? (at|for)|employed (at|by)|job (at|with))\b/.test(evidence)) return false
  return true
}

function semanticKnown(f, value, field) {
  const incoming = normText(f.v)
  const stored = normText(value)
  const negative = (s) => /\b(not|never|no longer|isnt|doesnt|didnt)\b/.test(s)
  if (negative(incoming) !== negative(stored)) return false
  if (incoming === stored) return true
  if (['how', 'fact'].includes(field) && /\b(relationship|how|connection)\b/i.test(f.k) &&
      /\b(from work|coworker|colleague)\b/.test(incoming) && /\b(coworker|colleague|from work)\b/.test(stored)) return true
  const inputTokens = contentTokens(f.v)
  const storedTokens = contentTokens(value)
  return inputTokens.length > 0 && inputTokens.every((token) => storedTokens.includes(token))
}

function checkOutcome(f, existing, basics, decision) {
  if (!safeProfileFact(f)) return 'context'
  const exact = existing.find((old) => (old.topic || 'other') === f.topic &&
    normText(old.k) === normText(f.k) && normText(old.v) === normText(f.v))
  if (exact) return 'already_known'
  const sameLabel = existing.some((old) => (old.topic || 'other') === f.topic && normText(old.k) === normText(f.k) && normText(old.v) !== normText(f.v))
  if (sameLabel) return 'uncertain'
  if (decision.outcome === 'already_known' && decision.known) {
    const value = decision.known.field === 'fact' ? existing[decision.known.factIndex]?.v : basics[decision.known.field]
    if (value && semanticKnown(f, value, decision.known.field)) return 'already_known'
  }
  if (existing.some((old) => compareFact(old, f))) return 'uncertain'
  if (decision.outcome === 'already_known') return 'uncertain'
  return decision.outcome
}

function nextEntry(entry, patch) {
  return { ...entry, ...patch, revision: entry.revision + 1, updatedAt: new Date().toISOString() }
}

function localToday(timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

const factKey = (f) => `${f.topic || 'other'}|${normText(f.k)}|${normText(f.v)}`
const stripSupport = (value) => {
  const copy = structuredClone(value)
  delete copy.journalSources
  return copy
}

async function saveEntry(before, after, other = [], unique = [], reads = []) {
  const checks = [{ t: 'journal', id: after.id, doc: before || null }, ...other.map((o) => ({ t: o.t, id: o.id, doc: o.before ?? null })),
    ...reads.filter((r) => !other.some((o) => o.t === r.t && o.id === r.id))]
  const ops = [...other.map((o) => ({ t: o.t, id: o.id, op: o.after == null ? 'del' : 'put', ...(o.after == null ? {} : { doc: o.after }) })),
    { t: 'journal', id: after.id, op: 'put', doc: after }]
  const result = await repo.commitJournal(checks, ops, unique)
  return result.ok ? { ok: true, entry: after } : result
}

export async function putJournal(id, body) {
  if (!repo.journalAvailable()) return fail('unavailable', 'Journal storage is not installed here yet.')
  if (!repo.ID.test(id)) return fail('bad_id', 'Bad entry id.')
  const previous = store.get('journal')[id] || null
  const valid = validateJournalInput(body, previous)
  if (!valid.ok) return fail('invalid', valid.message)
  if (previous && body.text !== previous.text) return fail('conflict', 'The original entry cannot change. Start a new entry to revise the text.')
  if (previous && body.revision !== previous.revision) return fail('conflict', 'This entry changed. Reload and try again.')
  if (!previous && body.revision != null && body.revision !== 0) return fail('conflict', 'This entry changed. Reload and try again.')
  if (!previous && !aiStatus(store.get('settings')).available) return fail('ai_off', 'AI is switched off.')
  if (previous?.status === 'saved') return fail('conflict', 'Undo the saved entry before editing it.')
  if (previous?.status === 'undone') return fail('conflict', 'This entry was undone. Start a new entry.')
  const now = new Date().toISOString()
  const entry = previous ? nextEntry(previous, {
    text: body.text, answers: { ...previous.answers, ...(body.answers || {}) },
    status: body.answers ? 'needs_details' : 'draft', error: undefined,
  }) : {
    id, schemaVersion: 1, revision: 1, text: body.text, referenceDate: body.referenceDate,
    timeZone: body.timeZone, createdAt: now, updatedAt: now, status: 'draft', questions: [], answers: {},
  }
  return saveEntry(previous, entry)
}

export async function processJournal(id, revision, { ask = providerAsk } = {}) {
  if (!repo.journalAvailable()) return fail('unavailable', 'Journal storage is not installed here yet.')
  const entry = store.get('journal')[id]
  if (!entry) return fail('not_found', 'Journal entry not found.')
  if (entry.status === 'saved' || entry.status === 'undone') return { ok: true, entry }
  if (!aiStatus(store.get('settings')).available) return fail('ai_off', 'AI is switched off.')
  if (!Number.isSafeInteger(revision) || revision !== entry.revision) return fail('conflict', 'This entry changed. Reload and try again.')
  const originalPeople = structuredClone(store.get('people'))
  const originalEvents = structuredClone(store.get('events'))
  const people = structuredClone(originalPeople)
  const events = structuredClone(originalEvents)
  const source = [entry.text, ...Object.values(entry.answers || {})].join('\n')
  const prompts = ['journal-extract', 'journal-reconcile'].map((name) => {
    const p = loadPrompt(name)
    return `${p.name}@${p.version}`
  })
  const provenance = { model: MODEL, prompts, at: new Date().toISOString() }
  try {
    const extracted = await pass(ask, 'extract', {
      entry: entry.text, answers: entry.answers, referenceDate: entry.referenceDate, timeZone: entry.timeZone,
      allowedKinds: [...kinds], allowedTopics: [...topics],
    }, (value) => extractValid(value, source))
    const mentions = [...new Set([...(extracted.event?.people || []), ...extracted.facts.map((f) => f.mention)])]
    const choices = new Map()
    const questions = []
    for (const mention of mentions) {
      const id = journalQuestionId('person', mention)
      const choice = personChoice(people, mention, entry.answers[id])
      choices.set(mention, choice)
      if (!choice.id && !choice.create) {
        const options = choice.candidates.map((pid) => ({ value: pid, label: people[pid].name }))
        options.push({ value: `create:${mention}`, label: `Add ${mention}` })
        questions.push(question(id, `Who is ${mention}?`, 'person', options))
      }
    }
    let date = null
    if (extracted.event) {
      date = entry.answers.date || resolveJournalDate(extracted.event.datePhrase, entry.referenceDate)
      if (!date || !isYMD(date)) questions.push(question('date', 'What was the exact date?', 'date'))
    }
    const context = extracted.facts.map((f, index) => ({
      index, fact: f, personId: choices.get(f.mention)?.id || null,
      existing: choices.get(f.mention)?.id ? (people[choices.get(f.mention).id].facts || []).slice(0, 60) : [],
      basics: choices.get(f.mention)?.id ? {
        how: String(people[choices.get(f.mention).id].how || '').slice(0, 300),
        group: GROUPS.find((g) => g.id === people[choices.get(f.mention).id].group)?.label || '',
        birthday: String(people[choices.get(f.mention).id].birthday || '').slice(0, 10),
      } : {},
    }))
    const reconciled = await pass(ask, 'reconcile', { entry: entry.text, answers: entry.answers, facts: context }, (value) => reconcileValid(value, context))
    const decisionByIndex = new Map(reconciled.decisions.map((d) => [d.index, d]))
    const outcomes = []
    extracted.facts.forEach((f, index) => {
      const choice = choices.get(f.mention)
      const prior = choice?.id ? people[choice.id].facts || [] : []
      const decision = decisionByIndex.get(index)
      let outcome = checkOutcome(f, prior, context[index].basics, decision)
      const qid = journalQuestionId('fact', `${f.mention} ${f.k} ${f.v}`)
      const attribution = needsAttribution(f) && decision.attribution !== 'clear'
      // Only unresolved attribution needs confirmation; clear contextual pronouns are normal input.
      const answerId = attribution ? journalQuestionId('attribution', `${f.mention} ${f.k} ${f.v} ${f.evidence}`) : qid
      const answer = entry.answers[answerId]
      const proposedOutcome = outcome
      if (attribution && outcome !== 'context') outcome = 'uncertain'
      if (outcome === 'uncertain') {
        if (answer === 'add') outcome = proposedOutcome === 'already_known' ? 'already_known' : 'add'
        else if (answer === 'skip') outcome = 'context'
        else questions.push(question(answerId, attribution
          ? `Does "${f.evidence}" refer to ${f.mention}?`
          : `Should Orbit remember "${f.k}: ${f.v}" for ${f.mention}?`, 'fact', [
          { value: 'add', label: attribution ? 'Yes, remember for this person' : 'Add as a new fact' }, { value: 'skip', label: 'Keep only in this entry' },
        ]))
      }
      outcomes.push({ index, outcome, evidence: f.evidence, mention: f.mention, ...(outcome === 'already_known' && decision.known ? { known: decision.known } : {}) })
    })
    if (questions.length) return saveEntry(entry, nextEntry(entry, { status: 'needs_details', questions, error: undefined, provenance, outcomes }))

    const changes = []
    const unique = []
    const resolved = new Map()
    const mutations = { people: {}, eventId: null, supportedEventId: null }
    for (const mention of mentions) {
      const choice = choices.get(mention)
      if (choice.id) resolved.set(mention, choice.id)
      else if (choice.create) {
        const pid = newId('p')
        const doc = { name: choice.create, group: 'other', birthday: '', how: '', notes: '', facts: [], intents: [], createdAt: new Date().toISOString() }
        people[pid] = doc
        resolved.set(mention, pid)
        changes.push({ t: 'people', id: pid, before: null, after: doc })
        unique.push({ t: 'people', id: pid, name: doc.name })
        mutations.people[pid] = { created: true, addedFacts: [], supportedFacts: [] }
      }
    }
    extracted.facts.forEach((f, index) => {
      if (outcomes[index].outcome !== 'add') return
      const pid = resolved.get(f.mention)
      if (!pid) return
      const fact = { k: f.k, v: f.v, topic: f.topic, journalEntryId: id,
        source: { journalEntryId: id, evidence: f.evidence, ...provenance } }
      const previous = people[pid]
      const updated = { ...previous, facts: [...(previous.facts || []), fact] }
      people[pid] = updated
      const existing = changes.find((c) => c.t === 'people' && c.id === pid)
      if (existing) existing.after = updated
      else changes.push({ t: 'people', id: pid, before: originalPeople[pid], after: updated })
      mutations.people[pid] ||= { created: false, addedFacts: [], supportedFacts: [] }
      mutations.people[pid].addedFacts.push(fact)
    })
    extracted.facts.forEach((f, index) => {
      if (outcomes[index].outcome !== 'already_known') return
      const pid = resolved.get(f.mention)
      if (!pid) return
      const before = people[pid]
      const indexInPerson = outcomes[index].known?.field === 'fact' ? outcomes[index].known.factIndex
        : (before.facts || []).findIndex((old) => factKey(old) === factKey(f))
      if (indexInPerson < 0) return
      const facts = [...before.facts]
      const support = { journalEntryId: id, evidence: f.evidence, ...provenance }
      facts[indexInPerson] = { ...facts[indexInPerson], journalSources: [...(facts[indexInPerson].journalSources || []), support] }
      people[pid] = { ...before, facts }
      const existing = changes.find((c) => c.t === 'people' && c.id === pid)
      if (existing) existing.after = people[pid]
      else changes.push({ t: 'people', id: pid, before: originalPeople[pid], after: people[pid] })
      mutations.people[pid] ||= { created: false, addedFacts: [], supportedFacts: [] }
      mutations.people[pid].supportedFacts.push(factKey(before.facts[indexInPerson]))
    })
    let eventId
    let occasionRead = null
    if (extracted.event) {
      const peopleIds = [...new Set(extracted.event.people.map((m) => resolved.get(m)).filter(Boolean))]
      if (!peopleIds.length) {
        outcomes.push({ outcome: 'context', note: 'No attendee was identified for an event.' })
      } else {
      const event = { date, kind: extracted.event.kind, people: peopleIds, place: extracted.event.place,
        title: extracted.event.kind, notes: '', status: date > localToday(entry.timeZone) ? 'planned' : 'done', updates: {}, createdAt: new Date().toISOString(),
        journalId: id }
      const duplicate = findDuplicateEvent(events, event)
      if (duplicate?.match === 'exact') {
        const other = events[duplicate.id]
        occasionRead = { t: 'events', id: duplicate.id, doc: originalEvents[duplicate.id] }
        const samePlace = normText(other.place) === normText(event.place)
        const decision = entry.answers['event:occasion']
        if (!samePlace && !['same', 'separate'].includes(decision)) {
          questions.push(question('event:occasion', `Is this the same ${event.kind.toLowerCase()} already logged on ${date}, or another occasion?`, 'fact', [
            { value: 'same', label: 'Same occasion' }, { value: 'separate', label: 'Separate occasion' },
          ]))
        }
        if (!samePlace && decision === 'separate') {
          eventId = `e_${id.slice(0, 62)}`
          changes.push({ t: 'events', id: eventId, before: originalEvents[eventId] || null, after: event })
          mutations.eventId = eventId
          mutations.savedEvent = event
        } else if (!samePlace && !decision) {
          // The final save is deferred until the occasion question is answered.
        } else {
        outcomes.push({ outcome: 'already_known', eventId: duplicate.id })
        const before = events[duplicate.id]
        changes.push({ t: 'events', id: duplicate.id, before, after: {
          ...before, journalSources: [...(before.journalSources || []), { journalEntryId: id, at: provenance.at }],
        } })
        mutations.supportedEventId = duplicate.id
        }
      } else {
        eventId = `e_${id.slice(0, 62)}`
        changes.push({ t: 'events', id: eventId, before: originalEvents[eventId] || null, after: event })
        unique.push({ t: 'events', id: eventId, doc: event })
        mutations.eventId = eventId
        mutations.savedEvent = event
      }
      }
    }
    if (questions.length) return saveEntry(entry, nextEntry(entry, { status: 'needs_details', questions, error: undefined, provenance, outcomes }))
    for (const [pid, m] of Object.entries(mutations.people)) {
      if (m.created) m.createdDoc = changes.find((c) => c.t === 'people' && c.id === pid)?.after
    }
    const eventRef = eventId || mutations.supportedEventId
    const attendeeNames = extracted.event?.people.map((m) => people[resolved.get(m)]?.name || m).join(', ')
    const eventSummary = extracted.event && eventRef
      ? `${eventId ? date > localToday(entry.timeZone) ? 'Planned' : 'Logged' : 'Already logged'} ${extracted.event.kind.toLowerCase()} with ${attendeeNames} on ${date}${extracted.event.place ? ` at ${extracted.event.place}` : ''}.`
      : 'Saved the journal entry without an event.'
    const lines = [eventSummary, ...outcomes.filter((o) => Number.isInteger(o.index)).map((o) => {
      const f = extracted.facts[o.index]
      const name = people[resolved.get(f.mention)]?.name || f.mention
      const action = o.outcome === 'add' ? 'Added' : o.outcome === 'already_known' ? 'Already known' : 'Kept in this entry'
      return `${action}: ${f.k}: ${f.v} for ${name}.`
    })]
    const receipt = { summary: eventSummary, lines, ...(eventRef ? { eventId: eventRef } : {}) }
    const reads = extracted.event?.people.map((m) => resolved.get(m)).filter((pid) => pid && !changes.some((c) => c.t === 'people' && c.id === pid))
      .map((pid) => ({ t: 'people', id: pid, exists: true })) || []
    if (occasionRead) reads.push(occasionRead)
    return saveEntry(entry, nextEntry(entry, { status: 'saved', questions: [], error: undefined, provenance, outcomes, receipt, mutations }), changes, unique, reads)
  } catch (error) {
    if (error.validation) provenance.validation = error.validation
    return saveEntry(entry, nextEntry(entry, { status: 'error', questions: [], error: error.message.startsWith('The model') ? error.message : 'Processing failed. Retry this entry.', provenance }))
  }
}

export async function undoJournal(id, revision) {
  if (!repo.journalAvailable()) return fail('unavailable', 'Journal storage is not installed here yet.')
  const entry = store.get('journal')[id]
  if (!entry) return fail('not_found', 'Journal entry not found.')
  if (entry.status === 'undone') return { ok: true, entry }
  if (entry.status !== 'saved' || revision !== entry.revision) return fail('conflict', 'This entry changed. Reload and try again.')
  const mutations = entry.mutations || { people: {}, eventId: null }
  const changes = []
  if (mutations.eventId) {
    const event = store.get('events')[mutations.eventId]
    if (!event || JSON.stringify(stripSupport(event)) !== JSON.stringify(mutations.savedEvent)) {
      return fail('conflict', 'The event changed; undo needs review.')
    }
    const later = (event.journalSources || []).filter((s) => s.journalEntryId !== id)
    if (later.length) return fail('conflict', 'A later entry also supports this event; undo needs review.')
    changes.push({ t: 'events', id: mutations.eventId, before: event, after: null })
  }
  if (mutations.supportedEventId) {
    const event = store.get('events')[mutations.supportedEventId]
    if (!event) return fail('conflict', 'The event changed; undo needs review.')
    changes.push({ t: 'events', id: mutations.supportedEventId, before: event,
      after: { ...event, journalSources: (event.journalSources || []).filter((s) => s.journalEntryId !== id) } })
  }
  for (const [pid, m] of Object.entries(mutations.people)) {
    const current = store.get('people')[pid]
    if (!current) return fail('conflict', 'A person changed; undo needs review.')
    const facts = [...(current.facts || [])]
    for (const added of m.addedFacts) {
      const index = facts.findIndex((f) => JSON.stringify(stripSupport(f)) === JSON.stringify(added))
      if (index < 0) return fail('conflict', 'A fact changed; undo needs review.')
      const later = (facts[index].journalSources || []).filter((s) => s.journalEntryId !== id)
      if (later.length) facts[index] = { ...facts[index], journalEntryId: later[0].journalEntryId,
        source: { ...later[0] }, journalSources: later }
      else facts.splice(index, 1)
    }
    for (const key of m.supportedFacts || []) {
      const index = facts.findIndex((f) => factKey(f) === key)
      if (index < 0) return fail('conflict', 'A supported fact changed; undo needs review.')
      facts[index] = { ...facts[index], journalSources: (facts[index].journalSources || []).filter((s) => s.journalEntryId !== id) }
    }
    if (m.created) {
      if (JSON.stringify({ ...current, facts: current.facts?.map(stripSupport) }) !==
          JSON.stringify({ ...m.createdDoc, facts: m.createdDoc?.facts?.map(stripSupport) }) ||
          Object.entries(store.get('events')).some(([eid, e]) => eid !== mutations.eventId && e.people?.includes(pid)) ||
          Object.entries(store.get('people')).some(([otherId, p]) => otherId !== pid && p.facts?.some((f) => f.ref === pid))) {
        return fail('conflict', 'A new person has other information; undo needs review.')
      }
      changes.push({ t: 'people', id: pid, before: current, after: facts.length ? { ...current, facts } : null })
    } else changes.push({ t: 'people', id: pid, before: current, after: { ...current, facts } })
  }
  return saveEntry(entry, nextEntry(entry, { status: 'undone', error: undefined }), changes)
}
