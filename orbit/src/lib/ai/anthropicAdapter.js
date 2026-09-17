// Calls the server's AI routes (<api>/ai/...). The key and the model stay on the server.
import { apiHeaders, apiUrl } from '../runtime.js'

async function post(path, body, signal) {
  let res
  try {
    res = await fetch(apiUrl(`/ai/${path}`), {
      method: 'POST',
      headers: { ...(await apiHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new Error("Can't reach the Orbit server.")
  }
  const out = await res.json().catch(() => ({}))
  if (!res.ok || !out.ok) throw Object.assign(new Error(out.message || 'The AI request failed.'), { code: out.code })
  return out
}

export const anthropicAdapter = {
  available: true,
  /** Writes person.summary on the server. Returns the text. */
  picture: (personId) => post('picture', { personId }).then((r) => r.summary),
  /** Writes person.questions on the server. Returns the 5 questions. */
  questions: (personId) => post('questions', { personId }).then((r) => r.questions),
  /** A draft text message. Not saved. */
  sayHi: (personId) => post('sayhi', { personId }).then((r) => r.message),
  /** messages: [{ role, content }] ending with the user's turn. Returns { reply, lines, wrote }. */
  interview: (messages, signal, session) => post('interview', { messages, session }, signal),
}
