import { useOrbit } from '../../state/OrbitContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import { useTheme } from '../../state/useTheme.js'
import { RINGS } from '../../lib/constants.js'
import { formatCents } from '../../lib/money.js'
import Button from '../ui/Button.jsx'
import Badge from '../ui/Badge.jsx'
import { SelectField } from '../ui/Field.jsx'
import DataCheck from './DataCheck.jsx'

const THEMES = [
  { value: 'system', label: 'Match my device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export default function SettingsPage() {
  const { health, settings, storage, people, events } = useOrbit()
  const { open, openPage, notify } = useUI()
  const [theme, setTheme] = useTheme()
  const ai = health?.ai

  const exportAll = async () => {
    try {
      const data = await storage.exportData()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = Object.assign(document.createElement('a'), { href: url, download: `orbit-export-${data.exportedAt.slice(0, 10)}.json` })
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      notify(`Export failed: ${e.message}`, { tone: 'danger' })
    }
  }

  return (
    <div className="stack-lg">
      <section className="section">
        <h3 className="section-title">Data</h3>
        <dl className="facts-dl">
          <dt>Storage</dt>
          <dd>{health?.storage === 'supabase' ? 'Supabase (shared with heyScottyBro)' : health ? 'Local JSON files' : 'Unknown'}</dd>
          <dt>Location</dt>
          <dd className="mono break">{health?.dataDir ?? 'Unknown (server not reachable)'}</dd>
          <dt>Records</dt>
          <dd>
            {Object.keys(people).length} people · {Object.keys(events).length} events
          </dd>
          <dt>Backups</dt>
          <dd>
            {!health
              ? '—'
              : health.storage === 'supabase'
                ? 'Supabase keeps the database backups'
                : `${health.backups} in data/backups (one per file per minute at most, newest 50 kept)`}
          </dd>
          <dt>Schema</dt>
          <dd>v{health?.schemaVersion ?? '?'}</dd>
        </dl>
        <div className="row-actions">
          <Button size="sm" variant="secondary" onClick={exportAll}>
            Export everything (JSON)
          </Button>
          <Button size="sm" variant="secondary" onClick={() => open('import')}>
            Import people (JSON)
          </Button>
        </div>
      </section>

      <section className="section">
        <h3 className="section-title">Data check</h3>
        <DataCheck />
      </section>

      <section className="section">
        <div className="section-head">
          <h3 className="section-title">Gift budgets</h3>
          <Button size="sm" variant="ghost" onClick={() => open('budgets')}>
            Edit
          </Button>
        </div>
        <dl className="facts-dl">
          {RINGS.slice(0, 3).map((r, i) => (
            <div key={r} className="contents">
              <dt>{r}</dt>
              <dd>
                {formatCents(settings.budget.xmas[i])} Christmas · {formatCents(settings.budget.bday[i])} birthday
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="section">
        <div className="section-head">
          <h3 className="section-title">AI</h3>
          <Button size="sm" variant="ghost" onClick={() => openPage('connectors')}>
            Manage
          </Button>
        </div>
        <dl className="facts-dl">
          <dt>Status</dt>
          <dd>
            {ai?.available ? <Badge tone="success">On</Badge> : <Badge>Off</Badge>}{' '}
            {!ai?.hasKey && 'No ANTHROPIC_API_KEY in .env'}
            {ai?.hasKey && !ai?.enabled && 'Switched off in Connectors'}
          </dd>
          <dt>Model</dt>
          <dd className="mono">{ai?.model ?? '—'}</dd>
          <dt>Key</dt>
          <dd>{ai?.hasKey ? 'Set on the server (never sent to the browser)' : 'Not set'}</dd>
        </dl>
      </section>

      <section className="section">
        <h3 className="section-title">Appearance</h3>
        <SelectField label="Theme" value={theme} onChange={setTheme} options={THEMES} />
      </section>
    </div>
  )
}
