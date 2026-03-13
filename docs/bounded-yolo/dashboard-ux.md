# Gas Town Dashboard UX: Navigable Views

## Problem

The current dashboard is a single-page HUD showing all concepts simultaneously (Convoys, Polecats, Sessions, Hooks, Mail, Activity, etc.). This works well for experienced operators but creates a steep learning curve for new users who don't know what to look at first or how concepts connect.

## Goal

Add navigable pages alongside the existing Command Center HUD. Each page focuses on one mental model. The HUD remains the power-user default. New pages are linked from a left nav and from contextual links within the HUD itself.

## Design Principles

- The existing Command Center HUD is preserved as-is (labeled "Command Center" in nav)
- New pages are additive, not replacements
- Each page answers one question a user would naturally ask
- Pages link to each other where concepts overlap
- Built with the existing htmx + Go template stack (no new frontend framework, no design system overhaul)
- Data comes from existing Dolt tables and activity events (no new backend APIs unless necessary)
- All agent/polecat views are strictly read-only — no input, no nudge, no send-keys from the UI
- DAG visualization is contextual (per-convoy), not a standalone page

---

## Navigation: Left Sidebar

```
┌──────────────────┐
│ 🏘️ Gas Town       │
│                  │
│ ⚡ Command Center │
│ 📊 Pipeline       │
│ 🎩 Mayor          │
│ 🤖 Agents         │
│                  │
│ RIGS             │
│ ├─ gastown       │
│ └─ devsecops_demo│
│                  │
│ ❓ Tour           │
└──────────────────┘
```

- Left nav is persistent across all pages
- Rigs section is collapsible, shows all registered rigs
- Clicking a rig opens the Rig Detail page
- Active page is highlighted
- Nav collapses to icons on narrow viewports

### Success Criteria

- [ ] Left nav renders on all pages
- [ ] Active page is visually highlighted
- [ ] Rig list populates dynamically from registered rigs
- [ ] Clicking a rig navigates to Rig Detail
- [ ] Nav is collapsible

---

## Page 1: Command Center (Existing HUD)

The current dashboard, unchanged. Renamed to "Command Center" in the nav.

### Success Criteria

- [ ] Existing HUD renders identically
- [ ] No functional regressions
- [ ] Left nav is added without breaking layout

---

## Page 2: Pipeline

**Question it answers:** "What's the overall status of my work?"

### Layout

Horizontal pipeline visualization showing work flowing left to right:

```
[Planned] → [Assigned] → [In Progress] → [In Review] → [Merged]
   7            3              1              0            0
```

- Each stage is a column with a count badge
- Click a stage to expand and see the beads in that state
- Each bead card shows: title, rig, assigned polecat (if any), time in current stage
- Color-coded: green (healthy), yellow (>10min in stage), red (>30min or failed)
- Filter bar: by rig, by priority, by convoy

### Success Criteria

- [ ] Pipeline renders with correct counts derived from bead status
- [ ] Clicking a stage expands to show individual beads
- [ ] Bead cards link to Bead Detail page
- [ ] Stages update live (htmx polling)
- [ ] Filter by rig works
- [ ] Works with 0 beads (empty state), 1 bead, and 50+ beads

---

## Page 3: Mayor Conversation

**Question it answers:** "What did I tell the Mayor and what did it do?"

### Layout

Chat-style interface showing the conversation between human and Mayor:

```
┌──────────────────────────────────────────┐
│ You (10:01 AM)                           │
│ Read PLAN.md and create beads for each   │
│ phase...                                 │
│                                          │
│ Mayor (10:02 AM)                         │
│ I'll read the plan and create the beads. │
│                                          │
│ 📋 Created bead dd-9e5: Phase 1          │
│ 📋 Created bead dd-h5l: Phase 2          │
│ 📋 Created bead dd-xto: Phase 3          │
│ ...                                      │
│                                          │
│ Mayor (10:05 AM)                         │
│ All 7 beads created. Slinging Phase 1... │
│                                          │
│ 🎯 Slung dd-9e5 → furiosa (kiro)        │
│                                          │
│ [Type a message...]              [Send]  │
└──────────────────────────────────────────┘
```

- Messages from human and Mayor in chat bubbles
- Agent actions (bead creation, slings, nudges) rendered as rich cards inline
- Input box at bottom sends instructions via `gt nudge mayor`
- Scrollable history
- Replaces the need to `tmux attach` for most Mayor interactions

### Success Criteria

- [ ] Conversation history reconstructed from Mayor's activity events and/or tmux log
- [ ] New messages appear in real-time
- [ ] Sending a message delivers via `gt nudge mayor`
- [ ] Action cards (bead created, work slung) are visually distinct from text
- [ ] Works when Mayor is idle (shows last conversation)
- [ ] Works when Mayor is actively working (streams output)
- [ ] Input box is the ONLY place in the UI that sends text to an agent

---

## Page 4: Agents

**Question it answers:** "What are my agents doing right now?"

### Layout

Grid of read-only cards, one per active agent (polecats + Mayor + Witness + Refinery):

```
┌─────────────────────────┐  ┌─────────────────────────┐
│ 🦨 furiosa              │  │ 🎩 Mayor                │
│ Rig: devsecops_demo     │  │ Status: Idle             │
│ Working on: Phase 1     │  │ Runtime: kiro-cli        │
│ Runtime: kiro-cli       │  │ Last active: 2m ago      │
│ ⏱ 4m 32s               │  │                          │
│ Status: Working         │  │ > Created 7 beads for    │
│                         │  │   devsecops_demo         │
│ > terraform validate    │  │                          │
│ > Success! 0 errors     │  │ [View Logs]              │
│                         │  │                          │
│ [View Logs]             │  │                          │
└─────────────────────────┘  └─────────────────────────┘
```

- Live terminal preview: last 3-5 lines of tmux pane output (read-only, no interaction)
- Status derived from: tmux session alive + heartbeat + pane activity
- "View Logs" links to full session log (read-only)
- NO input box, NO nudge button, NO send-keys — strictly observation only
- Cards grouped by: System agents (Mayor, Deacon, Witness, Refinery) and Worker agents (polecats)
- Click agent name to go to Agent Detail page

### Success Criteria

- [ ] Cards render for all active tmux sessions
- [ ] Terminal preview updates every 3-5 seconds (read-only)
- [ ] Status correctly reflects: working / idle / stuck / dead
- [ ] No interactive elements that could send input to agents
- [ ] Cards appear/disappear as agents spawn/die
- [ ] Grouped into System and Worker sections
- [ ] Click navigates to Agent Detail

---

## Page 5: Guided Tour

**Question it answers:** "What is all this and how do I use it?"

### Layout

Interactive walkthrough that appears on first visit (dismissable, re-accessible from nav):

1. "This is your Town — your workspace for coordinating AI agents."
   → Highlights the left nav and rig list

2. "These are your Rigs — each one is a project with its own repo."
   → Highlights the Rigs section in nav

3. "The Mayor is your coordinator. Tell it what to build."
   → Links to Mayor Conversation page

4. "Work gets broken into Beads (tasks) and assigned to Polecats (workers)."
   → Links to Pipeline view

5. "Watch your agents work in real-time — but don't touch."
   → Links to Agents page, emphasizes read-only

6. "When agents finish, work flows through the Refinery (merge queue) to main."
   → Links to Command Center merge queue panel

### Success Criteria

- [ ] Walkthrough appears on first visit (localStorage flag)
- [ ] Each step highlights the relevant UI element with an overlay
- [ ] Steps link to the appropriate page
- [ ] Dismissable at any point
- [ ] Re-accessible from "Tour" in left nav
- [ ] Doesn't block usage — user can interact during the tour

---

## Detail Pages

### Rig Detail

**Question it answers:** "What's happening in this project?"

**Accessed from:** Left nav rig list, or any rig name link in the UI.

### Layout

```
┌─────────────────────────────────────────────────────┐
│ 🏗️ devsecops_demo                                   │
│ Repo: github.com/elfisher/devsecops-demo            │
│ Branch: main | Agents: 1 active | Beads: 7 open     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ CONVOYS                                             │
│ ┌─────────────────────────────────────────────┐     │
│ │ 🚚 hq-cv-ftwyo — DevSecOps Demo Build       │     │
│ │ 7 beads | 1 in progress | 0 merged          │     │
│ │ [View Details]                               │     │
│ └─────────────────────────────────────────────┘     │
│                                                     │
│ ACTIVE AGENTS                                       │
│ 🦨 furiosa — Phase 1 (working, 4m)                  │
│                                                     │
│ RECENT ACTIVITY                                     │
│ 10:05 AM  Slung dd-9e5 → furiosa                   │
│ 10:02 AM  Created 7 beads from PLAN.md              │
│ 10:01 AM  Rig added                                 │
│                                                     │
│ MERGE QUEUE                                         │
│ No PRs in queue                                     │
└─────────────────────────────────────────────────────┘
```

- Header: rig name, repo URL, branch, summary counts
- Convoys section: list of convoys for this rig, each clickable to Convoy Detail
- Active agents: polecats currently working in this rig (links to Agent Detail)
- Recent activity: filtered activity feed for this rig only
- Merge queue: refinery status for this rig

### Success Criteria

- [ ] Renders for any registered rig
- [ ] Convoy list shows all convoys with beads in this rig
- [ ] Active agents list matches tmux sessions for this rig's polecats
- [ ] Activity feed filters to this rig only
- [ ] Merge queue shows refinery status
- [ ] All names/IDs are clickable links to their detail pages
- [ ] Works with 0 convoys, 0 agents (empty rig state)

---

### Convoy Detail

**Question it answers:** "How is this batch of work progressing?"

**Accessed from:** Rig Detail convoy list, Pipeline bead cards, or any convoy ID link.

### Layout

```
┌─────────────────────────────────────────────────────┐
│ 🚚 hq-cv-ftwyo — DevSecOps Demo Build               │
│ Rig: devsecops_demo | Created: 10:02 AM             │
│ Status: In Progress (1/7 complete)                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│ DEPENDENCY GRAPH                                    │
│                                                     │
│ [Phase 1] → [Phase 2] → [Phase 3]                  │
│     🔵          ⚪          ⚪                       │
│                    ↘                                │
│                [Phase 4] → [Phase 5]                │
│                    ⚪          ⚪                    │
│                                  ↘                  │
│                              [Phase 6] → [Phase 7]  │
│                                  ⚪          ⚪     │
│                                                     │
│ ⚪ Planned  🔵 In Progress  🟢 Done  🔴 Failed      │
│                                                     │
│ BEADS                                               │
│ ┌───────┬──────────────────────┬──────────┬───────┐ │
│ │ ID    │ Title                │ Agent    │Status │ │
│ ├───────┼──────────────────────┼──────────┼───────┤ │
│ │dd-9e5 │ Phase 1: CI/CD       │ furiosa  │ 🔵    │ │
│ │dd-h5l │ Phase 2: EKS         │ —        │ ⚪    │ │
│ │dd-xto │ Phase 3: Observ.     │ —        │ ⚪    │ │
│ │dd-1il │ Phase 4: K8s         │ —        │ ⚪    │ │
│ │dd-zin │ Phase 5: Chaos       │ —        │ ⚪    │ │
│ │dd-??? │ Phase 6: Bedrock     │ —        │ ⚪    │ │
│ │dd-??? │ Phase 7: Pipeline    │ —        │ ⚪    │ │
│ └───────┴──────────────────────┴──────────┴───────┘ │
│                                                     │
│ TIMELINE                                            │
│ 10:05 AM  Slung dd-9e5 → furiosa                   │
│ 10:03 AM  Dependencies set: 1→2→3, 2→4→5, 5→6→7   │
│ 10:02 AM  Convoy created with 7 beads               │
└─────────────────────────────────────────────────────┘
```

- Header: convoy name, rig, creation time, progress summary
- Dependency graph: DAG of this convoy's beads, color-coded by status, click node → Bead Detail
- Beads table: all beads in this convoy with status, assigned agent
- Timeline: activity events scoped to this convoy

### Success Criteria

- [ ] DAG renders from `bd dep` data for beads in this convoy
- [ ] Node colors update live as bead status changes
- [ ] Clicking a DAG node navigates to Bead Detail
- [ ] DAG handles: no dependencies (flat list), linear chain, complex branching
- [ ] DAG renders cleanly for 3-20 nodes without overlapping
- [ ] Beads table shows all beads with correct status and agent assignment
- [ ] Bead IDs link to Bead Detail
- [ ] Agent names link to Agent Detail
- [ ] Timeline shows convoy-scoped events only
- [ ] Works for convoys with 1 bead and convoys with 20+ beads

---

### Bead Detail

**Question it answers:** "What happened with this specific task?"

**Accessed from:** Pipeline bead cards, Convoy Detail table/DAG, or any bead ID link.

### Layout

```
┌─────────────────────────────────────────────────────┐
│ 📿 dd-9e5 — Phase 1: CI/CD & Security Foundations    │
│ Rig: devsecops_demo | Priority: P1 | Status: 🔵     │
│ Convoy: hq-cv-ftwyo | Agent: furiosa                │
├─────────────────────────────────────────────────────┤
│                                                     │
│ DESCRIPTION                                         │
│ Create terraform/ directory with OIDC provider,     │
│ IAM role, GuardDuty, Inspector, Security Hub,       │
│ Macie, WAF, CloudTrail.                             │
│                                                     │
│ ACCEPTANCE CRITERIA                                 │
│ ☐ terraform validate passes                         │
│ ☐ terraform plan produces no errors                 │
│ ☐ Files exist: main.tf, oidc.tf, security.tf       │
│ ☐ No hardcoded AWS account IDs or secrets           │
│ ☐ Required resource blocks present                  │
│                                                     │
│ TIMELINE                                            │
│ 10:05 AM  Hooked to furiosa                         │
│ 10:06 AM  Agent session started (kiro-cli)          │
│ 10:08 AM  Files created: terraform/main.tf (+45)    │
│ 10:09 AM  Files created: terraform/oidc.tf (+38)    │
│ 10:10 AM  Files created: terraform/security.tf (+89)│
│ 10:12 AM  Agent ran: terraform validate ✓           │
│ 10:13 AM  Committed: "feat: phase 1 foundations"    │
│ 10:14 AM  gt done → branch pushed                   │
│ 10:15 AM  Refinery: merge queued                    │
│                                                     │
│ FILES CHANGED                                       │
│ + terraform/main.tf         (+45 lines)  [View Diff]│
│ + terraform/oidc.tf         (+38 lines)  [View Diff]│
│ + terraform/security.tf     (+89 lines)  [View Diff]│
│ + terraform/variables.tf    (+22 lines)  [View Diff]│
│                                                     │
│ AGENT OUTPUT (read-only, last 20 lines)             │
│ ┌─────────────────────────────────────────────┐     │
│ │ > terraform validate                        │     │
│ │ Success! The configuration is valid.        │     │
│ │ > git add -A && git commit -m "feat: ..."   │     │
│ │ [main abc1234] feat: phase 1 foundations     │     │
│ │ > gt done                                   │     │
│ └─────────────────────────────────────────────┘     │
│ [View Full Log]                                     │
└─────────────────────────────────────────────────────┘
```

- Header: bead ID, title, rig, priority, status, convoy, assigned agent
- Description: full bead description
- Acceptance criteria: checklist from bead, checkmarks filled as criteria are met
- Timeline: full event history for this bead (created, assigned, hooked, files changed, commands run, committed, done, merged)
- Files changed: list of files with line counts, expandable diffs
- Agent output: read-only terminal excerpt (last N lines from tmux log or session log)
- "View Full Log" links to complete session log file (read-only)

### Success Criteria

- [ ] Renders for any bead ID
- [ ] Description and acceptance criteria pulled from bead data
- [ ] Timeline reconstructed from activity events and git log
- [ ] File diffs viewable inline (expandable)
- [ ] Agent output is read-only excerpt from session log
- [ ] "View Full Log" opens full log (read-only)
- [ ] All linked entities (convoy, agent, rig) are clickable
- [ ] Works for beads in any state: open, in_progress, closed, failed
- [ ] Works for beads with no agent assigned (planned state)
- [ ] Acceptance criteria checkmarks update as verification passes

---

### Agent Detail

**Question it answers:** "What is this specific agent doing and what has it done?"

**Accessed from:** Agent Cards grid, Rig Detail agent list, Bead Detail agent link, or any agent name link.

### Layout

```
┌─────────────────────────────────────────────────────┐
│ 🦨 furiosa                                           │
│ Rig: devsecops_demo | Runtime: kiro-cli              │
│ Status: Working | Session: gt-furiosa | ⏱ 12m 45s    │
├─────────────────────────────────────────────────────┤
│                                                     │
│ CURRENT WORK                                        │
│ 📿 dd-9e5 — Phase 1: CI/CD & Security Foundations    │
│ Hooked at 10:05 AM | [View Bead]                    │
│                                                     │
│ LIVE OUTPUT (read-only)                             │
│ ┌─────────────────────────────────────────────┐     │
│ │ > Creating terraform/security.tf...         │     │
│ │ > Adding GuardDuty detector resource        │     │
│ │ > Adding Inspector enabler resource         │     │
│ │ > Adding Security Hub account resource      │     │
│ │ > Running terraform validate...             │     │
│ │ > Success! The configuration is valid.      │     │
│ │                                             │     │
│ │                                             │     │
│ │                                             │     │
│ │                                             │     │
│ └─────────────────────────────────────────────┘     │
│ Auto-refreshes every 3s | [View Full Log]           │
│                                                     │
│ WORK HISTORY                                        │
│ (No previous work — first assignment)               │
│                                                     │
│ SESSION INFO                                        │
│ tmux session: gt-furiosa                            │
│ Working dir: ~/gt/devsecops_demo/polecats/furiosa/  │
│ Git branch: polecat/furiosa/dd-9e5@...              │
│ PID: 33220                                          │
│ Heartbeat: 3s ago                                   │
└─────────────────────────────────────────────────────┘
```

- Header: polecat name, rig, runtime, status, session name, elapsed time
- Current work: the hooked bead with link to Bead Detail
- Live output: read-only terminal view, last 15-20 lines from tmux capture, auto-refreshes every 3 seconds. NO input capability.
- Work history: previous beads this polecat has completed (persistent identity means history accumulates)
- Session info: technical details (tmux session, working directory, git branch, PID, last heartbeat)
- "View Full Log" links to complete session log (read-only)

### Success Criteria

- [ ] Renders for any active polecat or system agent
- [ ] Current work shows hooked bead with link to Bead Detail
- [ ] Live output updates every 3 seconds (read-only, no input)
- [ ] NO interactive elements that could send input to the agent
- [ ] Work history shows previously completed beads (if any)
- [ ] Session info is accurate (matches tmux session state)
- [ ] Heartbeat shows time since last heartbeat touch
- [ ] Status correctly reflects: working / idle / stuck / dead
- [ ] Works for polecats with no current work (idle state)
- [ ] Works for system agents (Mayor, Witness, Refinery, Deacon) with appropriate fields
- [ ] "View Full Log" opens complete log (read-only)

---

## Cross-Cutting: Contextual Links

Every entity ID in the UI is a clickable link to its detail page:

| Entity | Link target | Example |
|---|---|---|
| Bead ID (`dd-9e5`) | Bead Detail | Anywhere a bead ID appears |
| Convoy ID (`hq-cv-ftwyo`) | Convoy Detail | Pipeline, Rig Detail, Activity |
| Polecat name (`furiosa`) | Agent Detail | Agent Cards, Bead Detail, Rig Detail |
| Rig name (`devsecops_demo`) | Rig Detail | Left nav, Pipeline, Agent Cards |

### Success Criteria

- [ ] All bead IDs are clickable links across all pages
- [ ] All convoy IDs are clickable links across all pages
- [ ] All agent names are clickable links across all pages
- [ ] All rig names are clickable links across all pages
- [ ] Links work from the Command Center HUD as well as new pages

---

## Technical Approach

- All pages use the existing Go template + htmx stack
- Left nav is a shared template partial included on every page
- Live updates via htmx polling (existing pattern)
- Terminal preview in Agent Detail/Cards via periodic `tmux capture-pane` endpoint
- DAG in Convoy Detail rendered client-side with lightweight JS (dagre-d3 or elkjs)
- Mayor Conversation reconstructed from activity events + tmux log parsing
- No new database tables — all data derivable from existing Dolt tables and activity events
- Existing CSS/dark theme used as-is (no design system overhaul for v1)
- Mobile-responsive is nice-to-have, not required

## Out of Scope (v1)

- Replacing the Command Center HUD
- Design system overhaul (defer to v2 after UX is validated)
- Real-time WebSocket connections (htmx polling sufficient)
- Multi-user / auth (Gas Town is single-user)
- Editing beads from the UI (use `bd` CLI)
- Full terminal emulator in browser (read-only last-N-lines only)
- Nudge/input from any page except Mayor Conversation
