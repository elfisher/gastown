# Dashboard V2: Specification

## Overview

A standalone TypeScript dashboard for Gas Town that provides navigable, focused views for understanding and monitoring multi-agent workflows. Runs as its own process, fetches data via CLI commands, validates all data with Zod schemas.

## Architecture

### Isolation Principles

- Lives in `dashboard-v2/` at repo root — standalone Node/TS project
- No Go imports, no shared code with `internal/web/`
- Data fetched via CLI (`gt`, `bd`, `tmux`) — validated with Zod before rendering
- Runs on its own port (default 8081)
- Own `package.json`, `tsconfig.json`, own test suite

### Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js + TypeScript | Type safety, Zod integration, agent-friendly |
| Server | Fastify | Fast, typed, good plugin ecosystem |
| Templating | htmx + server-rendered HTML | No SPA complexity, live updates via polling |
| Design | Tailwind CSS + DaisyUI (CDN) | Dark theme, pre-built components, no build step for CSS |
| Validation | Zod | Runtime schema validation for all CLI output |
| DAG | ELK.js | Lightweight dependency graph layout |
| Testing | Vitest | Fast, TS-native, compatible with Fastify |

### Data Layer

Every piece of data comes from a CLI command. Every CLI response is validated against a Zod schema before use. If validation fails, the error is surfaced in the UI (not silently swallowed).

```typescript
// Example: beads data
const BeadSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['open', 'in_progress', 'hooked', 'closed']),
  priority: z.number().min(0).max(4),
  assignee: z.string().optional(),
  type: z.string().optional(),
});

const BeadListSchema = z.array(BeadSchema);

async function listBeads(rigPath: string): Promise<z.infer<typeof BeadListSchema>> {
  const raw = await exec(`cd ${rigPath} && bd list --format=json`);
  return BeadListSchema.parse(JSON.parse(raw.stdout));
}
```

---

## Directory Structure

```
dashboard-v2/
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts              # Fastify server entry point
│   ├── routes.ts              # Route definitions
│   ├── config.ts              # Port, town root, polling intervals
│   ├── data/
│   │   ├── schemas.ts         # All Zod schemas
│   │   ├── beads.ts           # bd CLI queries + validation
│   │   ├── agents.ts          # gt + tmux queries + validation
│   │   ├── convoys.ts         # gt/bd convoy queries + validation
│   │   ├── rigs.ts            # gt rig queries + validation
│   │   ├── events.ts          # Event file reader + validation
│   │   ├── git.ts             # Git log/diff queries
│   │   └── exec.ts            # Shell exec wrapper with timeout + error handling
│   ├── pages/
│   │   ├── layout.ts          # Shared layout renderer (left nav)
│   │   ├── pipeline.ts        # Pipeline page
│   │   ├── agents.ts          # Agents page
│   │   ├── agent-detail.ts    # Agent detail page
│   │   ├── mayor.ts           # Mayor conversation page
│   │   ├── rig.ts             # Rig detail page
│   │   ├── convoy.ts          # Convoy detail + DAG page
│   │   ├── bead.ts            # Bead detail page
│   │   └── tour.ts            # Guided tour page
│   └── api/
│       ├── pipeline.ts        # htmx polling endpoint
│       ├── agents.ts          # Agent card refresh endpoint
│       ├── mayor.ts           # Mayor messages + nudge endpoint
│       └── terminal.ts        # tmux capture endpoint
├── static/
│   ├── app.js                 # DAG rendering (ELK.js), tour logic
│   └── app.css                # Tailwind overrides if needed
├── templates/
│   ├── layout.html            # Base layout with nav, Tailwind/DaisyUI CDN
│   ├── pipeline.html
│   ├── agents.html
│   ├── agent-detail.html
│   ├── mayor.html
│   ├── rig.html
│   ├── convoy.html
│   ├── bead.html
│   └── tour.html
├── test/
│   ├── data/
│   │   ├── schemas.test.ts    # Schema validation tests
│   │   ├── beads.test.ts      # Mock CLI output tests
│   │   └── agents.test.ts     # Mock CLI output tests
│   ├── pages/
│   │   └── pipeline.test.ts   # Handler tests
│   └── fixtures/
│       ├── bd-list.json       # Sample bd output
│       ├── gt-agents.json     # Sample gt output
│       └── tmux-capture.txt   # Sample tmux output
└── README.md
```

---

## Design System: Tailwind + DaisyUI

- Dark theme default: `data-theme="dark"`
- CDN-loaded (no build step):
  ```html
  <link href="https://cdn.jsdelivr.net/npm/daisyui@4/dist/full.min.css" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  ```
- Component mapping in Page sections below

### Color Semantics

| Status | DaisyUI class | Hex | Usage |
|---|---|---|---|
| Working | `badge-primary` | blue | Agent working, bead in progress |
| Complete | `badge-success` | green | Merged, check passed |
| Planned | `badge-ghost` | gray | Unassigned, idle |
| Slow | `badge-warning` | yellow | >10min in stage, stale heartbeat |
| Failed | `badge-error` | red | Failed bead, dead session |

---

## Phases

### Phase 1: Foundation

**Goal:** Standalone TS server with layout, left nav, and route skeleton. Every subsequent phase builds on this.

**Deliverables:**
- `package.json` with dependencies (fastify, zod, typescript, vitest, htmx)
- `tsconfig.json` with strict mode
- `src/server.ts` — Fastify server on port 8081, serves static files and templates
- `src/routes.ts` — all routes registered, each returns placeholder HTML with layout
- `src/config.ts` — town root detection (reads `GT_ROOT` env or finds `~/gt`)
- `src/pages/layout.ts` — renders `templates/layout.html` with left nav
- `templates/layout.html` — base layout with Tailwind CDN, DaisyUI CDN, left nav using `drawer` + `menu` components
- `src/data/rigs.ts` + `src/data/schemas.ts` — rig list query with Zod validation
- Left nav dynamically populated with rigs from `gt rig list`

**Verification:**
- [ ] `npm install` succeeds with no errors
- [ ] `npm run build` compiles with zero TS errors (`tsc --noEmit`)
- [ ] `npm start` starts server, `curl http://localhost:8081/` returns 200 with HTML containing left nav
- [ ] All routes return 200: `/`, `/pipeline`, `/agents`, `/mayor`, `/rig/:name`, `/convoy/:id`, `/bead/:id`, `/agent/:name`, `/tour`
- [ ] Left nav contains rig names fetched from `gt rig list`
- [ ] `npm test` passes — at minimum: server starts, routes return 200, rig schema validates sample data
- [ ] No `any` types in source (enforced by `tsconfig.json` strict mode)

---

### Phase 2: Data Layer + Schemas

**Goal:** All Zod schemas defined and tested. All CLI data fetchers implemented with validation. This is the typed contract between CLI output and UI.

**Deliverables:**
- `src/data/schemas.ts` — complete Zod schemas for: Bead, BeadList, Convoy, ConvoyList, Agent, AgentList, Rig, RigList, Event, TmuxSession, GitDiff
- `src/data/exec.ts` — shell exec wrapper with configurable timeout, stderr capture, error typing
- `src/data/beads.ts` — `listBeads()`, `getBead()`, `getBeadDeps()`
- `src/data/agents.ts` — `listAgents()`, `getAgentPreview()`, `getAgentDetail()`
- `src/data/convoys.ts` — `listConvoys()`, `getConvoy()`
- `src/data/rigs.ts` — `listRigs()`, `getRig()`
- `src/data/events.ts` — `getEvents()`, `getEventsForBead()`, `getEventsForConvoy()`
- `src/data/git.ts` — `getGitLog()`, `getGitDiff()`
- `test/fixtures/` — sample CLI output for each command

**Verification:**
- [ ] Every schema has at least 3 test cases: valid data passes, missing required field fails, wrong type fails
- [ ] Every data fetcher has a test using fixture data (mocked exec)
- [ ] `exec.ts` handles: command not found, timeout, non-zero exit, stderr
- [ ] Zod parse errors include the field name and expected type (not just "validation failed")
- [ ] `npm test` passes all data layer tests
- [ ] No `as any` or `@ts-ignore` in data layer code
- [ ] `bd list --format=json` output validates against BeadListSchema (integration test with real CLI, skippable in CI)

---

### Phase 3: Pipeline Page

**Goal:** Users can see all work across rigs flowing through stages, with live updates.

**Deliverables:**
- `src/pages/pipeline.ts` — handler that queries beads, groups by status, renders template
- `templates/pipeline.html` — DaisyUI `stats` for stage counts, `card` for bead cards, `badge` for status
- `src/api/pipeline.ts` — htmx endpoint returning updated pipeline HTML fragment
- Filter bar: by rig (DaisyUI `select`), by priority, by convoy
- Click stage to expand bead list
- Bead cards link to `/bead/:id`

**Verification:**
- [ ] `GET /pipeline` returns 200 with HTML containing stage counts
- [ ] Stage counts match `bd list` output (sum of beads per status)
- [ ] Bead cards render with: title, rig name, assigned agent, time in stage
- [ ] `GET /api/pipeline` returns HTML fragment (not full page) — verify no `<html>` tag
- [ ] Filter by rig returns only beads from that rig
- [ ] Empty state: 0 beads renders "No work items" message
- [ ] 50+ beads: page renders in <2 seconds
- [ ] Bead card links resolve to valid `/bead/:id` URLs
- [ ] `npm test` passes pipeline handler tests with fixture data

---

### Phase 4: Agents Page + Agent Detail

**Goal:** Users can see all agents at a glance and drill into any agent's live output (read-only).

**Deliverables:**
- `src/pages/agents.ts` + `templates/agents.html` — card grid, grouped by system/worker
- `src/pages/agent-detail.ts` + `templates/agent-detail.html` — full agent view with live output
- `src/api/agents.ts` — htmx endpoint for card refresh
- `src/api/terminal.ts` — htmx endpoint for tmux capture-pane output
- Cards show: name, rig, status badge, runtime, elapsed time, last 5 lines of output
- Agent detail shows: current work (linked), live output (15-20 lines), work history, session info

**Verification:**
- [ ] `GET /agents` returns 200 with cards for all active tmux sessions
- [ ] Cards grouped into "System Agents" and "Worker Agents" sections
- [ ] Terminal preview contains text from `tmux capture-pane` (not empty, not error)
- [ ] `GET /api/agents/:name/preview` returns HTML fragment with terminal output
- [ ] Agent detail page: `GET /agent/:name` returns 200 with live output section
- [ ] NO `<input>`, `<textarea>`, `<button>`, or `<form>` elements on agents page or agent detail (read-only enforced)
- [ ] Status badge correctly shows: working (primary), idle (ghost), dead (error)
- [ ] Agent name links on agents page navigate to `/agent/:name`
- [ ] `npm test` passes with mocked tmux output

---

### Phase 5: Rig Detail + Convoy Detail + DAG

**Goal:** Users can drill into a project, see its convoys, and visualize task dependencies.

**Deliverables:**
- `src/pages/rig.ts` + `templates/rig.html` — rig overview with convoys, agents, activity
- `src/pages/convoy.ts` + `templates/convoy.html` — convoy detail with DAG and beads table
- `src/data/convoys.ts` — convoy beads + dependency queries
- `static/app.js` — ELK.js DAG rendering, node click handlers
- DAG nodes colored by bead status, clickable to `/bead/:id`
- Beads table with status, agent, priority columns

**Verification:**
- [ ] `GET /rig/:name` returns 200 with convoy list, agent list, activity feed
- [ ] Convoy cards link to `/convoy/:id`
- [ ] `GET /convoy/:id` returns 200 with DAG SVG and beads table
- [ ] DAG renders for: 0 dependencies (flat list), linear chain (1→2→3), branching (1→2, 1→3)
- [ ] DAG nodes have correct colors matching bead status
- [ ] Clicking a DAG node navigates to `/bead/:id` (verify `onclick` or `<a>` wrapping)
- [ ] Beads table shows all beads in convoy with correct status and agent
- [ ] DAG renders cleanly for 3-20 nodes (no overlapping text, verify SVG viewBox)
- [ ] `npm test` passes with fixture convoy data including dependencies

---

### Phase 6: Bead Detail

**Goal:** Users can see the full story of any task — what was requested, what happened, what changed.

**Deliverables:**
- `src/pages/bead.ts` + `templates/bead.html`
- Description, acceptance criteria (checklist), timeline, files changed, agent output
- DaisyUI `timeline` for events, `collapse` for diffs, `mockup-code` for terminal output
- Breadcrumbs: Gas Town > Rig > Convoy > Bead

**Verification:**
- [ ] `GET /bead/:id` returns 200 with bead title, description, status
- [ ] Acceptance criteria rendered as checklist items
- [ ] Timeline shows events in chronological order with timestamps
- [ ] File diffs expandable (DaisyUI `collapse` component, verify `<details>` or equivalent)
- [ ] Agent output section is read-only `<pre>` block (no input elements)
- [ ] Breadcrumbs render with correct links (rig → convoy → bead)
- [ ] Works for beads in all states: open (no agent), hooked (in progress), closed (complete)
- [ ] `npm test` passes with fixture bead data in each state

---

### Phase 7: Mayor Conversation

**Goal:** Users can interact with the Mayor through a chat UI instead of tmux attach.

**Deliverables:**
- `src/pages/mayor.ts` + `templates/mayor.html`
- DaisyUI `chat` component for message bubbles
- Input box + send button at bottom
- `src/api/mayor.ts` — GET for messages (htmx polling), POST for nudge
- Action cards (bead created, work slung) rendered as `alert` components inline

**Verification:**
- [ ] `GET /mayor` returns 200 with chat UI
- [ ] Messages render in chronological order with timestamps and sender labels
- [ ] Human messages use `chat-end`, Mayor messages use `chat-start`
- [ ] `POST /api/mayor/nudge` with body `{message: "test"}` executes `gt nudge mayor "test"` and returns 200
- [ ] `GET /api/mayor/messages` returns HTML fragment with new messages since last poll
- [ ] Input box exists and is functional (this is the ONLY input in the entire dashboard)
- [ ] Action events (bead created, slung) render as visually distinct cards, not plain text
- [ ] `npm test` passes with mocked mayor tmux output and event data

---

### Phase 8: Contextual Links

**Goal:** Every entity ID anywhere in the UI is a clickable link to its detail page.

**Deliverables:**
- Utility function `linkify(text: string): string` that finds entity IDs and wraps in `<a>` tags
- Applied to all templates: pipeline, agents, rig, convoy, bead, agent detail, mayor
- Pattern matching: `dd-xxxxx` → `/bead/dd-xxxxx`, `hq-cv-xxxxx` → `/convoy/hq-cv-xxxxx`, polecat names → `/agent/:name`, rig names → `/rig/:name`

**Verification:**
- [ ] `linkify("Slung dd-9e5 to furiosa")` returns HTML with two links: bead and agent
- [ ] All bead IDs on pipeline page are `<a>` tags with correct href
- [ ] All agent names on agents page are `<a>` tags with correct href
- [ ] All convoy IDs on rig detail are `<a>` tags with correct href
- [ ] Links work from every page (not just detail pages)
- [ ] `npm test` passes linkify unit tests with 10+ patterns

---

### Phase 9: Guided Tour

**Goal:** New users get an interactive walkthrough explaining Gas Town concepts.

**Deliverables:**
- `src/pages/tour.ts` + `templates/tour.html`
- JS overlay in `static/app.js` using DaisyUI `modal` + `steps`
- 6 steps highlighting nav, rigs, mayor, pipeline, agents, merge queue
- localStorage flag `gastown-tour-complete`
- Auto-shows on first visit, re-accessible from nav

**Verification:**
- [ ] First visit to any page shows tour overlay (verify localStorage not set → modal visible)
- [ ] Second visit does not show tour (verify localStorage set → modal hidden)
- [ ] Each step highlights the correct UI element (verify `ring` class or equivalent on target)
- [ ] "Skip" button dismisses tour and sets localStorage flag
- [ ] "Next" advances to next step, "Back" goes to previous
- [ ] Tour accessible from nav link at any time (verify clicking "Tour" shows modal regardless of localStorage)
- [ ] `npm test` passes tour logic tests (localStorage mock)

---

## Cross-Cutting Verification (Every Phase)

- [ ] `npm run build` — zero TypeScript errors
- [ ] `npm test` — all tests pass
- [ ] `npm run lint` — zero ESLint errors (if configured)
- [ ] No `any` types in source code: `grep -r ": any" src/ | wc -l` returns 0
- [ ] No `@ts-ignore` or `@ts-expect-error` in source code
- [ ] All Zod schemas used for CLI output parsing (no raw `JSON.parse` without validation)
- [ ] All pages render with DaisyUI dark theme (no unstyled elements)
- [ ] All agent-facing pages are read-only (no input elements except Mayor page)
- [ ] Server starts and all existing routes still return 200 after changes

---

## Running

```bash
cd dashboard-v2
npm install
npm run build
npm start              # starts on port 8081
# or
npm run dev            # watch mode with auto-reload
```

## Out of Scope (v1)

- Replacing the existing Go dashboard
- WebSocket connections (htmx polling sufficient)
- Multi-user / auth
- Editing beads from the UI
- Full terminal emulator (read-only last-N-lines only)
- Nudge/input from any page except Mayor Conversation
- Mobile-optimized layout (responsive but desktop-first)
- Custom Tailwind build (CDN is fine for v1)
