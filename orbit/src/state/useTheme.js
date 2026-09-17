import { useEffect, useState } from 'react'
import { isEmbedded } from '../lib/runtime.js'

const KEY = 'orbit-theme'

function read() {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** 'system' | 'light' | 'dark', remembered per browser. */
export function useTheme() {
  const [theme, setTheme] = useState(read)
  useEffect(() => {
    if (isEmbedded()) return // the host app owns <html data-theme>
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
    try {
      if (theme === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, theme)
    } catch {
      /* private mode: theme just won't persist */
    }
  }, [theme])
  return [theme, setTheme]
}

export const isDark = (theme) => {
  if (isEmbedded()) {
    const host = document.documentElement.dataset.theme
    return host ? host === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return theme === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches : theme === 'dark'
}
