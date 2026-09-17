// Prompts live as versioned files (housestyle-ai AI-3). The version is saved next to every AI output.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { OWNER } from './config.js'

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'prompts')
const cache = new Map()

export function loadPrompt(name) {
  if (!cache.has(name)) {
    const raw = readFileSync(path.join(DIR, `${name}.md`), 'utf8')
    const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw)
    if (!m) throw new Error(`prompt ${name} is missing its front matter`)
    const version = Number(/version:\s*(\d+)/.exec(m[1])?.[1])
    if (!version) throw new Error(`prompt ${name} has no version`)
    cache.set(name, { name, version, text: m[2].trim().replaceAll('{{owner}}', OWNER) })
  }
  return cache.get(name)
}
