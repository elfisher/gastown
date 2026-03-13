# Dashboard V2: Specification

## Overview

A new, standalone dashboard for Gas Town that provides navigable, focused views for understanding and monitoring multi-agent workflows. Built as an isolated module within the gastown repo with no import dependencies on the existing dashboard.

## Architecture

### Isolation Principles

- Lives in `internal/dashboard/` — completely standalone package
- No imports from `internal/web/` (existing dashboard)
- Data fetched via CLI (`gt`, `bd`, `tmux`) — same interface humans use
- Runs on its own port (default 8081), coexists with existing dashboard
- Can be wired into `gt dashboard --v2` later

### Tech Stack

- **Go** — HTTP server, handlers, template rendering
- **Go html/template** — server-side rendering
- **htmx** — live updates, partial page swaps, polling
- **Tailwind CSS + DaisyUI** — design system, dark theme, pre-built components
- **ELK.js** — DAG layout for convoy dependency graphs
- **No JS framework** — vanilla JS where needed, htmx handles interactivity

### Data Layer

CLI-first. Each data module shells out to existing tools:

| Data | Source | Command |
|---|---|---|
| Beads/issues | Dolt via bd | `bd list --format=json`, `bd show <id> --format=json` |
| Convoys | Dolt via gt | `gt convoy list --json`, `gt convoy show <id> --json` |
| Agents/sessions | tmux | `tmux list-sessions`, `tmux capture-pane -t <session> -p` |
| Agent state | gt | `gt agents --json` |
| Activity events | Event files | Read from `internal/events/` on disk |
| Git info | git | `git log`, `git diff` in worktree directories |
| Rig info | gt | `gt rig list --json` |

If JSON output isn't available for a command, parse text output. Optimize to direct Dolt queries later if needed.

---

## Directory Structure

```
internal/dashboard/
├── main.go                 # HTTP server entry point
├── routes.go               # Route definitions
├── data/
│   ├── beads.go            # bd CLI queries
│   ├── agents.go           # gt + tmux queries
│   ├── convoys.go          # gt/bd convoy queries
│   ├── rigs.go             # gt rig queries
│   ├── events.go           # Event file reader
│   └── git.go              # Git log/diff queries
├── pages/
│   ├── layout.go           # Shared layout + left nav
│   ├── command_center.go   # Existing HUD (iframe or redirect)
│   ├── pipeline.go         # Pipeline page handler
│   ├── agents.go           # Agents page handler
│   ├── agent_detail.go     # Agent detail handler
│   ├── mayor.go            # Mayor conversation handler
│   ├── rig.go              # Rig detail handler
│   ├── convoy.go           # Convoy detail + DAG handler
│   ├── bead.go             # Bead detail handler
│   └── tour.go             # Guided tour handler
├── templates/
│   ├── layout.html         # Base layout with left nav, Tailwind/DaisyUI
│   ├── pipeline.html
│   ├── agents.html
│   ├── agent_detail.html
│   ├── mayor.html
│   ├── rig.html
│   ├── convoy.html
│   ├── bead.html
│   └── tour.html
├── static/
│   ├── app.js              # Minimal JS (DAG rendering, tour logic)
│   └── app.css             # Tailwind overrides if needed
└── dashboard_test.go       # Handler tests
```

---

## Design System

### Tailwind CSS + DaisyUI

- Dark theme by default (`data-theme="dark"` on html element)
- DaisyUI components used throughout:
  - `navbar` — top bar with town name and status
  - `menu` — left sidebar navigation
  - `card` — agent cards, convoy cards, bead cards
  - `table` — beads tables, session info
  - `badge` — status indicators (working, idle, stuck, dead)
  - `timeline` — event timelines on detail pages
  - `tabs` — section switching within detail pages
  - `stat` — count displays on pipeline stages
  - `alert` — error/warning states
  - `chat` — Mayor conversation bubbles
  - `collapse` — expandable sections (diffs, full output)
  - `steps` — guided tour progress
  - `breadcrumbs` — navigation context on detail pages
- Tailwind utilities for spacing, layout, responsive behavior
- CDN-loaded (no build step): `<link href="https://cdn.jsdelivr.net/npm/daisyui@latest/dist/full.min.css" rel="stylesheet">`

### Color Semantics

| Status | DaisyUI class | Usage |
|---|---|---|
| Working/Active | `badge-primary` | Agent working, bead in progress |
| Complete/Success | `badge-success` | Bead merged, check passed |
| Idle/Planned | `badge-ghost` | Unassigned bead, idle agent |
| Warning/Slow | `badge-warning` | Bead >10min in stage, agent stale |
| Failed/Dead | `badge-error` | Failed bead, dead session |
| Info | `badge-info` | Convoy status, system agents |

---

## Pages

### Left Nav (all pages)

```html
<div class="drawer lg:drawer-open">
  <div class="drawer-side">
    <ul class="menu bg-base-200 w-64 min-h-full">
      <li class="menu-title">Gas Town</li>
      <li><a href="/v2/">⚡ Command Center</a></li>
      <li><a href="/v2/pipeline">📊 Pipeline</a></li>
      <li><a href="/v2/mayor">🎩 Mayor</a></li>
      <li><a href="/v2/agents">🤖 Agents</a></li>
      <li class="menu-title">Rigs</li>
      <!-- dynamically populated -->
      <li><a href="/v2/rig/gastown">gastown</a></li>
      <li><a href="/v2/rig/devsecops_demo">devsecops_demo</a></li>
      <li class="mt-auto"><a href="/v2/tour">❓ Tour</a></li>
    </ul>
  </div>
  <div class="drawer-content p-6">
    <!-- page content -->
  </div>
</div>
```

### Page 1: Command Center

- Redirect to existing dashboard (`http://localhost:8080`) or embed via iframe
- Preserves full existing functionality
- Left nav wraps it

### Page 2: Pipeline

- DaisyUI `stats` component for stage counts
- `card` components for bead cards within each stage
- `badge` for status colors
- htmx: `hx-get="/v2/api/pipeline" hx-trigger="every 5s"` for live updates
- Filter bar using DaisyUI `select` components

### Page 3: Agents

- DaisyUI `card` grid (responsive: 1 col mobile, 2 col tablet, 3 col desktop)
- Each card: agent name, rig, status badge, runtime, elapsed time
- Terminal preview: `<pre>` block with monospace font, last 5 lines
- htmx: `hx-get="/v2/api/agents/<name>/preview" hx-trigger="every 3s"` per card
- Grouped with DaisyUI `divider`: "System Agents" / "Worker Agents"
- Strictly read-only — no buttons that send input

### Page 4: Mayor Conversation

- DaisyUI `chat` component for message bubbles
- `chat-start` for Mayor messages, `chat-end` for human messages
- Action cards (bead created, work slung) as `alert` components inline
- Input: DaisyUI `input` + `btn` at bottom, sends POST to `/v2/api/mayor/nudge`
- htmx: `hx-get="/v2/api/mayor/messages" hx-trigger="every 2s"` for new messages
- This is the ONLY page with an input element

### Page 5: Rig Detail

- DaisyUI `breadcrumbs`: Gas Town > Rigs > devsecops_demo
- `stats` row: agents active, beads open, beads merged
- `card` list for convoys
- `table` for active agents
- `timeline` for recent activity (filtered to this rig)

### Page 6: Convoy Detail + DAG

- `breadcrumbs`: Gas Town > Rigs > devsecops_demo > Convoy hq-cv-ftwyo
- DAG: rendered in a `<div>` by ELK.js, nodes are clickable SVG elements
- `table` for beads list with status badges
- `timeline` for convoy events
- DAG node colors match badge color semantics

### Page 7: Bead Detail

- `breadcrumbs`: Gas Town > ... > Bead dd-9e5
- `card` header with title, status badge, priority badge
- Description in `prose` (Tailwind typography)
- Acceptance criteria as DaisyUI `checkbox` list (read-only, checked = passed)
- `timeline` component for event history
- `collapse` components for file diffs
- `mockup-code` for agent output (read-only terminal style)

### Page 8: Agent Detail

- `breadcrumbs`: Gas Town > Agents > furiosa
- `stats` row: status, runtime, elapsed time, heartbeat
- Current work as linked `card`
- Live output: `mockup-code` with htmx polling every 3s
- `table` for work history
- `collapse` for session info (technical details)
- Strictly read-only

### Page 9: Guided Tour

- DaisyUI `steps` component for progress
- `modal` overlay for each step
- Highlight target elements with `ring` utility
- localStorage flag: `gastown-tour-complete`
- Accessible from nav, auto-shows on first visit

---

## API Endpoints (htmx)

All endpoints return HTML fragments for htmx partial swaps:

| Endpoint | Returns | Polling |
|---|---|---|
| `GET /v2/api/pipeline` | Pipeline stage counts + bead cards | 5s |
| `GET /v2/api/agents` | Agent cards HTML | 5s |
| `GET /v2/api/agents/:name/preview` | Terminal preview fragment | 3s |
| `GET /v2/api/mayor/messages` | New message bubbles | 2s |
| `POST /v2/api/mayor/nudge` | Sends nudge, returns confirmation | — |
| `GET /v2/api/rig/:name` | Rig detail sections | 10s |
| `GET /v2/api/convoy/:id` | Convoy beads + DAG data | 5s |
| `GET /v2/api/bead/:id` | Bead detail sections | 10s |
| `GET /v2/api/bead/:id/timeline` | Timeline fragment | 10s |
| `GET /v2/api/agent/:name/output` | Live terminal output | 3s |

---

## Implementation Beads

### Dependencies

```
Bead 1 (foundation) → Beads 2, 3, 4, 8 (parallel)
Bead 4 (rig detail) → Bead 5 (convoy detail)
Bead 5 (convoy detail) → Bead 6 (bead detail)
Bead 3 (agents) → Bead 7 (agent detail)
Beads 2-8 → Bead 9 (contextual links)
Bead 9 → Bead 10 (tour)
```

### Bead 1: Foundation (must be first)

- Create `internal/dashboard/` directory structure
- `main.go`: HTTP server on port 8081
- `routes.go`: all route definitions (handlers return placeholder "coming soon")
- `templates/layout.html`: base layout with Tailwind CDN, DaisyUI CDN, left nav
- `pages/layout.go`: template rendering helper
- Left nav with dynamic rig list (shells out to `gt rig list`)
- Verify: server starts, all routes return 200, left nav renders with rigs

### Bead 2: Pipeline Page

- `pages/pipeline.go` + `templates/pipeline.html`
- `data/beads.go`: query beads via `bd list`
- Stage counts, bead cards, click-to-expand
- htmx polling endpoint
- Verify: page renders with real bead data, stages update live

### Bead 3: Agents Page

- `pages/agents.go` + `templates/agents.html`
- `data/agents.go`: query tmux sessions + gt agents
- Read-only cards with terminal preview
- htmx polling for preview updates
- Verify: cards render for all active sessions, preview updates, no input elements

### Bead 4: Rig Detail

- `pages/rig.go` + `templates/rig.html`
- `data/rigs.go`: query rig info
- Convoys, agents, activity, merge queue sections
- Verify: renders for any rig, convoy links work

### Bead 5: Convoy Detail + DAG

- `pages/convoy.go` + `templates/convoy.html`
- `data/convoys.go`: query convoy beads + dependencies
- ELK.js DAG rendering in `static/app.js`
- Verify: DAG renders, nodes clickable, beads table correct

### Bead 6: Bead Detail

- `pages/bead.go` + `templates/bead.html`
- `data/git.go`: git log/diff for file changes
- Timeline, acceptance criteria, agent output
- Verify: renders for any bead, diffs expandable, output read-only

### Bead 7: Agent Detail

- `pages/agent_detail.go` + `templates/agent_detail.html`
- Live output via tmux capture, work history
- Verify: output updates every 3s, no input elements, session info accurate

### Bead 8: Mayor Conversation

- `pages/mayor.go` + `templates/mayor.html`
- `data/events.go`: reconstruct conversation from events + tmux log
- Chat UI with input box, sends via `gt nudge mayor`
- Verify: messages render, input sends nudge, new messages appear live

### Bead 9: Contextual Links

- Add `<a>` tags for all entity IDs across all templates
- Update existing HUD (Command Center) with links to v2 detail pages
- Verify: all IDs clickable, links resolve correctly

### Bead 10: Guided Tour

- `pages/tour.go` + `templates/tour.html`
- JS overlay in `static/app.js`
- localStorage persistence
- Verify: shows on first visit, dismissable, re-accessible from nav

---

## Testing Strategy

- `dashboard_test.go`: handler tests using `httptest`
- Each handler tested with mock CLI output (no real gt/bd/tmux needed)
- Template rendering verified (no broken template references)
- Verify all routes return 200
- Verify htmx endpoints return valid HTML fragments

## Out of Scope (v1)

- Replacing the existing dashboard
- Design system customization beyond DaisyUI defaults
- WebSocket connections (htmx polling is sufficient)
- Multi-user / auth
- Editing beads from the UI
- Full terminal emulator (read-only last-N-lines only)
- Nudge/input from any page except Mayor Conversation
- Mobile-optimized layout (responsive but desktop-first)
