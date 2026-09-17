// Prefixed, time-sortable ids: p_01J8Z3K4QX7M2N5B8C9D0E1F2G (ULID layout: 10 time chars + 16 random).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function encode(n, len) {
  let out = ''
  for (let i = 0; i < len; i++) {
    out = ALPHABET[n % 32] + out
    n = Math.floor(n / 32)
  }
  return out
}

export function newId(prefix) {
  const rand = crypto.getRandomValues(new Uint8Array(16))
  return `${prefix}_${encode(Date.now(), 10)}${Array.from(rand, (b) => ALPHABET[b % 32]).join('')}`
}
