// Used when there's no key or AI is switched off. `available: false` hides every AI control.
const off = () => Promise.reject(new Error('AI is switched off.'))

export const nullAdapter = {
  available: false,
  picture: off,
  questions: off,
  sayHi: off,
  interview: off,
}
