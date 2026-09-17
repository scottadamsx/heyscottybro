// Every model output passes one of these before it is saved or shown (housestyle-ai AI-4).

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u

export const countSentences = (text) => (text.match(/[^.!?]+[.!?]+(\s|$)/g) || []).length || (text.trim() ? 1 : 0)
export const hasEmoji = (text) => EMOJI.test(text)

const ok = (value) => ({ ok: true, value })
const bad = (problem) => ({ ok: false, problem })

/** Emoji are never allowed in generated text; removing them is deterministic, so do it rather than retry. */
export const stripEmoji = (text) => (text || '').replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu, '').replace(/ {2,}/g, ' ').trim()

export function checkPicture(raw) {
  const text = (raw || '').trim()
  if (!text) return bad('empty')
  if (hasEmoji(text)) return bad('used an emoji')
  if (/^\s*([-*•]|\d+\.)\s/m.test(text) || /^#/m.test(text)) return bad('used a list or heading')
  const n = countSentences(text)
  if (n > 6) return bad(`wrote ${n} sentences, the limit is 6`)
  return ok(text)
}

export function checkQuestions(parsed) {
  const list = parsed?.questions
  if (!Array.isArray(list)) return bad('no questions array')
  const clean = [...new Set(list.map((q) => String(q).trim()).filter(Boolean))]
  if (clean.length !== 5) return bad(`returned ${clean.length} distinct questions, expected 5`)
  if (clean.some((q) => q.length > 200)) return bad('a question is too long')
  if (clean.some(hasEmoji)) return bad('used an emoji')
  return ok(clean)
}

export function checkSayHi(raw) {
  const text = (raw || '').trim().replace(/^["“]|["”]$/g, '')
  if (!text) return bad('empty')
  if (hasEmoji(text)) return bad('used an emoji')
  if (/#\w/.test(text)) return bad('used a hashtag')
  const n = countSentences(text)
  if (n > 4) return bad(`wrote ${n} sentences, the limit is 3`)
  return ok(text)
}
