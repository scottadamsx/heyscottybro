import { useState } from 'react'
import { useOrbit } from '../../state/OrbitContext.jsx'
import Button from '../ui/Button.jsx'
import Badge from '../ui/Badge.jsx'

function Connector({ name, status, tone, children, action }) {
  return (
    <article className="connector">
      <div className="section-head">
        <h3 className="section-title">{name}</h3>
        <Badge tone={tone}>{status}</Badge>
      </div>
      <div className="stack-sm">{children}</div>
      {action && <div>{action}</div>}
    </article>
  )
}

export default function ConnectorsPage() {
  const { health, setAiEnabled } = useOrbit()
  const [busy, setBusy] = useState(false)
  const ai = health?.ai
  const toggle = async () => {
    setBusy(true)
    try {
      await setAiEnabled(!ai.enabled)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      {health?.storage === 'supabase' ? (
        <Connector name="Supabase" status="Connected" tone="success">
          <p>Your people and events live in Supabase, shared with the People space in heyScottyBro. Changes made in either place show up in the other on the next load.</p>
          <p className="mono break">{health.dataDir}</p>
        </Connector>
      ) : (
        <Connector name="Local files" status={health ? 'Connected' : 'Not reachable'} tone={health ? 'success' : 'danger'}>
          <p>Everything is saved as JSON on this computer. Only this machine can reach the data server.</p>
          {health && <p className="mono break">{health.dataDir}</p>}
        </Connector>
      )}

      <Connector
        name="Anthropic (Claude)"
        status={ai?.available ? 'Connected' : ai?.hasKey ? 'Disconnected' : 'No key'}
        tone={ai?.available ? 'success' : 'neutral'}
        action={
          ai?.hasKey && (
            <Button variant={ai.enabled ? 'quiet' : 'primary'} onClick={toggle} disabled={busy}>
              {ai.enabled ? 'Disconnect' : 'Connect'}
            </Button>
          )
        }
      >
        <p>Writes the picture, questions and say-hi drafts, and runs the interview. A person's saved notes are sent to Anthropic only when you press one of those buttons.</p>
        {!ai?.hasKey && (
          <p className="muted">
            To connect, add <code>ANTHROPIC_API_KEY</code> to <code>.env</code> in the project folder and restart <code>npm run dev</code>.
          </p>
        )}
        {ai?.model && <p className="muted">Model: <span className="mono">{ai.model}</span></p>}
      </Connector>

    </div>
  )
}
