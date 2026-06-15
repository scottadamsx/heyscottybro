import { DataTableFigure, DesignFigure, ScreensFigure, LayoutFigure } from "./figures";

/* Each step is its own page: a plain-English explanation for the non-technical
   reader, an optional figure, and a senior-engineer-grade prompt tied to our
   exact stack (React 18 + Vite, React Router v6, Tailwind + shadcn/ui,
   Supabase, Vercel) that the reader pastes into an AI to produce the artifact. */

export const STEPS = [
  {
    slug: "brief",
    num: 1,
    title: "The plan",
    blurb: "Talk it through before any code.",
    Figure: null,
    Plain: () => (
      <>
        <p>
          Before anyone writes a line, we just talk. Not a quiz — a conversation about what you&apos;re
          making and who it&apos;s for. Out of that comes a one-page summary called the
          <strong> build brief</strong>: the single source of truth everything else is built from.
        </p>
        <p>
          You answer in plain words. The prompt below makes the AI ask the right questions and write
          the brief up for you to approve.
        </p>
      </>
    ),
    prompt: `Act as a senior product engineer scoping a new app. Target stack: React 18 + Vite, React Router v6, Tailwind CSS + shadcn/ui, Supabase (Postgres, Auth, Row Level Security, Storage), deployed on Vercel.

Interview me ONE question at a time to produce a tight product brief. Cover: the problem and the primary user; the core entities (nouns) and their rough attributes; the primary user actions (verbs); the auth model (single vs multi-user, roles); data sensitivity (PII / payments / health — this drives how strict our RLS must be); third-party integrations; expected scale and whether anything needs realtime; and what success looks like.

Do NOT propose a schema or write any code yet. When we're done, output a one-page build brief and a short list of open questions and assumptions for me to confirm.`,
  },
  {
    slug: "platform",
    num: 2,
    title: "Where it lives",
    blurb: "Website, installable app, or native — and OS features.",
    Figure: null,
    Plain: () => (
      <>
        <p>
          A big decision people skip: <strong>what kind of thing is this, really?</strong> A plain
          website that opens in any browser? An installable web app people can add to their home
          screen? Or a full native app in the app stores? Almost everything should start as the first
          or second — native is far more work.
        </p>
        <p>
          We also settle the <strong>operating-system-level</strong> stuff now, because it&apos;s painful
          to add later: notifications, working offline, camera, location. Decide it on purpose, early.
        </p>
      </>
    ),
    prompt: `Act as a senior engineer. Given this brief: [paste your build brief].

Recommend the delivery target and justify it in plain language (I'm non-technical): (a) a responsive web app, (b) an installable PWA — web app manifest + service worker, add-to-home-screen, offline app shell, or (c) native via React Native / Expo. Default to responsive web or PWA unless a specific requirement forces native.

Then enumerate the OS-level capabilities the app needs — push notifications (Web Push vs native), offline / background sync, camera / file / geolocation access — and for each, the implementation approach on this stack and its limitations. Give me a clear recommendation with the trade-offs spelled out, then a one-line summary I can paste into my brief.`,
  },
  {
    slug: "data",
    num: 3,
    title: "The data",
    blurb: "The “things” your app remembers.",
    Figure: DataTableFigure,
    Plain: () => (
      <>
        <p>
          Every app is really just a list of things it remembers. We work through them one at a time —
          what each &ldquo;thing&rdquo; is, what details it holds, and how they connect. It ends up looking a
          lot like a spreadsheet&apos;s column headers:
        </p>
      </>
    ),
    prompt: `Act as a senior data modeller. From this brief [paste your build brief], work with me ONE entity at a time to define the domain model.

For each entity: list its fields with types, mark required vs optional, define relationships (one-to-many, or many-to-many via a join table), and note which fields are user-owned. Normalise sensibly, but call out where a JSONB column is the pragmatic choice and where an enum belongs. Ask me about anything ambiguous.

When complete, output a final entity-relationship table (entity → field → type → notes) for my approval. No SQL yet.`,
  },
  {
    slug: "database",
    num: 4,
    title: "The database",
    blurb: "Set up Supabase, safely.",
    Figure: null,
    Plain: () => (
      <>
        <p>
          Now we set up the real storage — a <strong>filing cabinet that lives online</strong>, so your
          data&apos;s still there tomorrow. The key thing it switches on from the very first moment:
          <strong> &ldquo;only you can see your own stuff.&rdquo;</strong>
        </p>
        <p>
          The prompt gives you ready-to-run setup code and tells you exactly where to paste it in
          Supabase.
        </p>
      </>
    ),
    prompt: `Act as a senior Postgres / Supabase engineer. From this approved data model [paste your approved model], generate an idempotent SQL migration for the Supabase SQL editor.

Requirements: CREATE TABLE with correct types and constraints; a user_id uuid referencing auth.users(id) on delete cascade; created_at and updated_at timestamptz, with a trigger that maintains updated_at; sensible indexes for the common access patterns; and Row Level Security ENABLED on every table with owner-scoped policies (auth.uid() = user_id) covering select, insert, update, and delete. Use IF NOT EXISTS where appropriate and add brief comments.

Tell me exactly where to paste this in the Supabase dashboard, and flag any cascade-delete or uniqueness decisions you need me to make.`,
  },
  {
    slug: "screens",
    num: 5,
    title: "The screens",
    blurb: "Map every page.",
    Figure: null,
    Plain: () => (
      <>
        <p>
          We lay out every screen and how they connect — and which ones need you logged in. Now we know
          exactly what we&apos;re building before a single page is made. No surprises.
        </p>
      </>
    ),
    prompt: `Act as a senior front-end architect. From the brief and data model [paste both], define the route map for React Router v6.

List every route, any nested layouts, and which routes are public vs protected (wrapped in an auth guard that redirects to login). For each route, note its type (list / detail / form / dashboard / settings) and which entities it reads or writes. Include the login/auth routes and a 404 catch-all. Lazy-load route components.

Output an approvable route tree. No component code yet.`,
  },
  {
    slug: "layout",
    num: 6,
    title: "Layout & navigation",
    blurb: "How it's structured and how you move around.",
    Figure: LayoutFigure,
    Plain: () => (
      <>
        <p>
          Now that we know the screens, two questions: <strong>how do you move between them, and how is
          each one laid out?</strong> This is the app&apos;s <em>structure</em> — completely separate from its
          colours (that&apos;s the next-to-last step).
        </p>
        <p>
          A bottom tab bar on your phone? A sidebar on a big screen? Should adding something pop up in a
          little window, or open its own page? These choices decide how the app <em>feels</em> to use, so
          we make them on purpose — not by accident.
        </p>
      </>
    ),
    prompt: `Act as a senior UX engineer and front-end architect. Given the route map [paste your route map] and the platform decision [paste it], propose the information architecture and layout system, and let me choose between the options.

Cover: the primary navigation pattern per breakpoint — e.g. a fixed bottom tab bar on mobile, a persistent sidebar or top nav on desktop — built from shadcn/ui primitives; the layout archetype for each route (list, a responsive table that collapses to cards on mobile, master–detail, or a dashboard grid using CSS auto-fit / minmax); how create and edit are handled (inline, a modal Dialog / Sheet, or a dedicated route) with the trade-offs of each; where loading, empty, and error states sit; and mobile ergonomics (44px touch targets, thumb-reachable primary actions, sticky headers vs a floating action button).

Show me the realistic options with quick ASCII wireframes, recommend a sensible default for each, and wait for my decisions before finalising.`,
  },
  {
    slug: "flows",
    num: 7,
    title: "How it works",
    blurb: "Every action, including what goes wrong.",
    Figure: null,
    Plain: () => (
      <>
        <p>
          The &ldquo;okay, but how does it <em>work</em>?&rdquo; step. We walk each action as a short story —
          including what happens when something goes wrong (a blank field, a failed save). Catching
          these on paper is free; catching them after it&apos;s built is not.
        </p>
      </>
    ),
    prompt: `Act as a senior engineer doing interaction design. For each primary user action in [paste your brief], specify the full flow.

For every action: the trigger, the optimistic UI update, the API call, the success state, and EVERY failure and edge case (validation, empty state, network failure, conflicting edits) with the exact user-facing message for each. Where an entity has a lifecycle, define its state machine: the states, the allowed transitions, and who can trigger them.

Flag anything underspecified as a direct question to me before finalising.`,
  },
  {
    slug: "ai",
    num: 8,
    title: "A brain? (optional)",
    blurb: "Add AI only if it truly needs it.",
    Figure: null,
    Plain: () => (
      <>
        <p>
          Now we ask: <strong>does this app need to think?</strong> Most don&apos;t — and skipping it saves
          money, so the prompt is told to be blunt about that. But if it does (say, identifying a plant
          from a photo), we decide it deliberately and wire it up <strong>safely</strong>.
        </p>
      </>
    ),
    prompt: `Act as a senior AI engineer. Be blunt about whether my app actually needs an LLM — here's what it does: [paste your brief]. If it doesn't need one, tell me to skip this step.

If it does: recommend the Claude model tier per use case (Haiku / Sonnet / Opus) with the cost and latency trade-offs; specify whether each use is read-only Q&A or tool-calling that mutates my data; and design the secure integration on our stack — a Vercel serverless function that proxies calls and holds the API key SERVER-SIDE (never in the client bundle), the request/response shape, streaming, and the tool-call loop with guardrails (turn budget, error-streak cap). Add per-user rate limiting to cap spend.

List any new tables (e.g. chat history) or routes this introduces so we update the schema and route map.`,
  },
  {
    slug: "design",
    num: 9,
    title: "The look",
    blurb: "Design pulled from pictures you love.",
    Figure: DesignFigure,
    Plain: () => (
      <>
        <p>
          The fun one. We don&apos;t ask &ldquo;what colours do you like?&rdquo; — that goes nowhere. Instead you
          paste <strong>screenshots of apps you love and one you hate</strong>, and the look gets pulled
          from the real pictures. You approve one example screen <em>before</em> anything is built — then
          every screen matches automatically.
        </p>
      </>
    ),
    prompt: `Act as a senior product designer. I'll paste 2–3 screenshots of apps whose look I love and 1 I dislike. Extract the design language from the ones I like.

Produce a theme: a full set of CSS custom properties — colour tokens for accent, backgrounds (base / elevated / raised), text (primary / secondary / muted), and semantic (success / warn / error) — for BOTH light and dark; a fluid type scale using clamp(); a spacing rhythm; corner radii; and an elevation/shadow style. Provide the matching Tailwind config and shadcn/ui theme variables.

Then render ONE representative screen using only these tokens so I can approve the look before any feature is built. [attach your screenshots]`,
  },
  {
    slug: "build",
    num: 10,
    title: "Build it",
    blurb: "One screen at a time — you test as it goes.",
    Figure: ScreensFigure,
    Plain: () => (
      <>
        <p>
          Only now does code get written — and even then, <strong>one screen at a time.</strong> Build a
          screen, stop, you test it, then the next. You&apos;re never handed a mystery box at the end.
        </p>
        <p>
          By the time the last screen is done, there&apos;s nothing left to be surprised by. The finished,
          working app <strong>is</strong> the final piece of the puzzle.
        </p>
      </>
    ),
    prompt: `Act as a senior full-stack engineer. All planning is approved — here are the artifacts: [paste your brief, platform decision, data model, SQL migration, route map, layout & navigation decisions, flows, any AI plan, and theme].

Scaffold the app on Vite + React 18 + React Router v6 + Tailwind + shadcn/ui + Supabase. Build the FOUNDATION first: an app-level error boundary, a toast system, an auth guard wrapping protected routes, the approved navigation shell (e.g. bottom tab bar on mobile / sidebar on desktop), a 404, lazy-loaded routes, and the approved theme as CSS variables. Use one api/ module per entity exposing load / create / update / delete, each wrapped in a resilient helper (remote call with graceful failure + a user-facing toast); use optimistic UI, validate-before-write, and partial-patch updates. Every data view needs loading, empty, and error states.

Then implement ONE route at a time, smallest/foundational first — its api module, page, and components — and after each, STOP and tell me exactly how to test it before continuing. Run migrations as needed.`,
  },
];

export const findStep = (slug) => STEPS.findIndex((s) => s.slug === slug);
