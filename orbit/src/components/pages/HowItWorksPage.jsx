const SECTIONS = [
  {
    title: 'What Orbit is for',
    body: [
      'A personal CRM: an ever-growing record of everyone in your life and everyone you meet, so you remember who they are, how you know them, what is going on with them, and what you meant to do for them.',
      'Search (the magnifier, or press /) looks through names, how you know people, their info, notes, updates and events. The interview answers questions the same way ("who works at Molson?") and only from what you saved.',
      'Follow-ups can have a date; the sidebar lists the soonest first and flags overdue ones. Notes added by the interview are dated, so old context is easy to tell from new.',
      'Every interview exchange is kept so conversations can be reviewed later: in data/chat-log.jsonl when Orbit runs on local files (npm run chats), or in heyScottyBro\'s agent activity log when it runs on Supabase.',
      'Settings › Import people takes an export (for example from Claude\'s memory of your chats), shows exactly what would change, and saves only when you confirm. It fills blanks, never overwrites what you told Orbit, skips guesses, marks imported notes "[from Claude]", and holds back anyone it could match to the wrong person.',
    ],
  },
  {
    title: 'What gets stored',
    body: [
      'Either three files in data/ or three Supabase tables shared with heyScottyBro\'s People space (orbit_people, orbit_events, orbit_settings): people (who they are, facts by topic, things you meant to do, gift ideas), events (every hangout, call, text and note, with who was there and what each person was up to), and settings (gift budgets and the AI switch).',
      'Every save is checked first: dates must be real, groups and kinds must be known, and money is stored in whole cents. Saves are written to a temporary file and then swapped in, so a crash never leaves a half-written file. A timestamped copy goes into data/backups at most once a minute, and the newest 50 per file are kept.',
      "If a file is ever corrupt, the server refuses to start rather than quietly starting empty and overwriting it. Restore a copy from data/backups.",
    ],
  },
  {
    title: 'Duplicates',
    body: [
      "Adding someone whose name matches an existing person (ignoring case, accents and punctuation) is blocked unless you say they're a different person. The same goes for logging the same occasion twice: same day, same kind, same people.",
      'Facts and to-dos that say the same thing in different words ("Wife: Susan" and "Spouse: married to Susan") are caught too; the more detailed one is kept. Settings › Data check lists anything that slipped through, such as duplicates in imported data, and merges it for you without throwing anything away.',
      'The interview agent goes through exactly the same checks.',
    ],
  },
  {
    title: 'Rings',
    body: [
      'Nothing about closeness is stored. It is worked out from your events every time anything changes. Each contact earns points: time together 3, a call 2, a text thread or conversation 1. Notes and plans earn nothing. "Last seen" still means in person.',
      '12 points in the last 90 days is Inner circle (four hangouts, or six calls). 6 points in 90 days is Close. 6 points in the last year is Regular. Any contact ever is Orbit. Nothing logged is Not logged.',
      "Each ring has a rhythm: every 21, 45, 120 or 365 days. Go past it and the person is drifting, shown with a red dot. The day badge turns amber at 70% of the rhythm.",
    ],
  },
  {
    title: 'Connections',
    body: [
      'A fact can point at someone else in Orbit ("Sister: Susan Adams"). Both people\'s Info tabs show the link, and Ask them uses the name ("How\'s Carter doing?") unless it\'s someone you see yourself, like your own family or your partner.',
      'Links follow merges, and if someone is removed, the fact keeps its text and loses the link.',
    ],
  },
  {
    title: 'The map',
    body: [
      "Each person sits on their ring. Where they sit around the circle comes from a small simulation: people you've been out with together pull toward each other (recent outings count more), people in the same group pull a little, and anyone overlapping is pushed apart.",
      'Groups are found by label propagation: everyone starts as their own group, then repeatedly joins the group most of their shared time is with. Any group of two or more is shown as a soft outline and listed under Groups, named after its two most connected people.',
      "The slider replays your history. Every number, ring and group is recalculated as of that day, ignoring anything after it.",
    ],
  },
  {
    title: 'Suggestions',
    body: [
      "Stats compare your last 90 days with the 90 before, the average gap between hangouts in the last year, how often it's one-on-one, and how much is calls and texts.",
      '"Work on" flags, in order: overdue, seeing them less than last quarter, always in a group, always the same kind of thing, mostly remote, no birthday, very little info, and open to-dos.',
      '"Ask them" builds questions from their newest updates, their facts, your open to-dos and an upcoming birthday. It uses only what you saved.',
    ],
  },
  {
    title: 'Claude',
    body: [
      "AI is optional. With no key, or with the connector switched off, every AI button disappears and everything else works the same.",
      "The picture, the 5 questions and the say-hi draft are written only from that person's saved notes, facts and history. If nothing is saved, Claude isn't asked. Each answer is checked (length, format, no emoji) before it's saved or shown, and the model and prompt version are recorded with it.",
      'The interview is an agent with six tools: look someone up, add a person, update a person, save an update, log an event (or a stretch of days), and save a to-do or gift idea. It saves as you talk and every tool call is written to data/agent-log.jsonl locally, or to heyScottyBro\'s agent activity log on Supabase.',
      'Each "saved" line in the chat shows exactly what was written. What was saved earlier is sent back with the conversation so nothing is saved twice, and if a reply says it saved something when nothing was saved, Orbit sends it back once and otherwise tells you plainly.',
    ],
  },
]

export default function HowItWorksPage() {
  return (
    <div className="stack-lg how">
      {SECTIONS.map((s) => (
        <section key={s.title} className="section">
          <h3 className="section-title">{s.title}</h3>
          {s.body.map((p) => (
            <p key={p.slice(0, 40)} className="prose">
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  )
}
