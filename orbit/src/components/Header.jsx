import { useDerived } from '../state/useDerived.js'
import { useEffect } from 'react'
import { useUI } from '../state/UIContext.jsx'
import { useTheme, isDark } from '../state/useTheme.js'
import { IconButton } from './ui/Button.jsx'
import { CircleHelp, Moon, Plug, Search, Settings, Sun } from './ui/icons.js'
import { appTitle, isEmbedded } from '../lib/runtime.js'

export default function Header() {
  const { stats } = useDerived()
  const { openPage, open, stack } = useUI()
  // "/" opens search from anywhere that isn't a text field.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || stack.length) return
      // composedPath: inside a shadow root (heyScottyBro), e.target is the host element.
      const el = e.composedPath?.()[0] || e.target
      if (/^(input|textarea|select)$/i.test(el.tagName) || el.isContentEditable) return
      e.preventDefault()
      open('search')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, stack.length])
  const [theme, setTheme] = useTheme()
  const dark = isDark(theme)
  const items = [
    [stats.people, 'people'],
    [stats.innerClose, 'inner + close'],
    [stats.hangouts30, 'hangouts / 30d'],
    [stats.clusters, 'clusters'],
    [stats.drifting, 'drifting'],
  ]
  return (
    <header className="header">
      <div className="header-top">
        <div>
          <div className="eyebrow">Your people</div>
          <h1>{appTitle()}</h1>
        </div>
        <nav className="header-nav" aria-label="App">
          <IconButton label="Search (/)" onClick={() => open('search')}>
            <Search size={16} />
          </IconButton>
          <IconButton label="How it works" onClick={() => openPage('how')}>
            <CircleHelp size={16} />
          </IconButton>
          <IconButton label="Connectors" onClick={() => openPage('connectors')}>
            <Plug size={16} />
          </IconButton>
          <IconButton label="Settings" onClick={() => openPage('settings')}>
            <Settings size={16} />
          </IconButton>
          {!isEmbedded() && (
            <IconButton label={`Switch to ${dark ? 'light' : 'dark'} theme`} onClick={() => setTheme(dark ? 'light' : 'dark')}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </IconButton>
          )}
        </nav>
      </div>
      <dl className="stats">
        {items.map(([n, label]) => (
          <div key={label} className="stat">
            <dt>{label}</dt>
            <dd>{n}</dd>
          </div>
        ))}
      </dl>
    </header>
  )
}
