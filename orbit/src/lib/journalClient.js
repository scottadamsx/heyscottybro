import { today } from './dates.js'
import { newId } from './ids.js'

export function journalContext() {
  return {
    referenceDate: today(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

export function pendingJournalDraft(current, text, seed = {}) {
  return current || { id: seed.id || newId('j'), context: { ...journalContext(), ...(seed.context || {}) }, text: text.trim() }
}

export function journalCounts(entries) {
  const values = Object.values(entries)
  return {
    total: values.length,
    pending: values.filter((entry) => ['draft', 'needs_details', 'error'].includes(entry.status)).length,
  }
}

export function mergeJournalEntries(loaded, current) {
  const merged = { ...loaded }
  for (const [id, entry] of Object.entries(current)) {
    if (!merged[id] || entry.revision > merged[id].revision) merged[id] = entry
  }
  return merged
}

export function journalAnswersReady(entry, answers) {
  return !!(entry.questions?.length > 0 && entry.questions.every((question) => {
    const value = String(answers[question.id] || '').trim()
    return value && (question.kind !== 'fact' || question.options?.some((option) => option.value === value))
  }))
}

export function sourceJournalId(record) {
  return record?.journalEntryId || record?.journalId || record?.source?.journalEntryId || record?.journalSources?.[0]?.journalEntryId || record?.source?.journalId || record?.source?.entryId || null
}

export async function createJournalEntry(text, { storage, ai, onEntry, context = journalContext(), id = newId('j') }) {
  const original = text.trim()
  let entry
  try {
    entry = (await storage.saveJournal(id, { text: original, ...context })).entry
  } catch (error) {
    const found = await storage.listJournals().then((out) => out.entries?.[id]).catch(() => null)
    if (!found || found.text !== original || found.referenceDate !== context.referenceDate || found.timeZone !== context.timeZone) throw error
    entry = found
  }
  onEntry(entry)
  if (['saved', 'needs_details', 'undone'].includes(entry.status)) return entry
  const processed = await ai.journal(id, entry.revision)
  onEntry(processed.entry)
  return processed.entry
}

export async function answerJournalEntry(entry, answers, { storage, ai, onEntry }) {
  const currentAnswers = Object.fromEntries(entry.questions.map((question) => [question.id, answers[question.id]]))
  const saved = await storage.saveJournal(entry.id, {
    text: entry.text,
    referenceDate: entry.referenceDate,
    timeZone: entry.timeZone,
    revision: entry.revision,
    answers: currentAnswers,
  })
  onEntry(saved.entry)
  const processed = await ai.journal(entry.id, saved.entry.revision)
  onEntry(processed.entry)
  return processed.entry
}
