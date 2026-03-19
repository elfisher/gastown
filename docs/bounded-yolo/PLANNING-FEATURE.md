# Planning Feature — Design Doc

## Product Goal

Give users a structured way to go from "I want X built" to a running convoy, without manually creating beads, setting dependencies, or writing dispatch instructions for the mayor.

## User Story

I'm looking at my gastown rig in the dashboard. I want to add a feature. I click "Plan", type what I want, and have a conversation with the mayor about how to break it down. When I'm happy with the plan, I say "go" and the mayor creates the beads, sets up the convoy, and dispatches the work. I watch the swarm execute in the dashboard.

## Success Criteria

1. **Zero manual bead creation.** The user never runs `bd create`, `bd dep add`, or `gt convoy create`. The mayor does it all.
2. **Interactive refinement.** The user can see the proposed plan, ask questions, add/remove tasks, change priorities, and adjust grouping before approving.
3. **Rig-scoped by default.** The plan targets a specific rig's codebase. The mayor explores that crig's repo, not the whole town.
4. **Correct dependency ordering.** Tasks in the same group are parallel. Groups are sequential. The mayor sets `bd dep add` relationships that match.
5. **One click to dispatch.** After approval, the convoy is created and dispatched without further user action.
6. **Visible in the dashboard.** The new convoy appears in the convoy list immediately. Progress is trackable.

## Non-Goals (for now)

- Custom planning UI components (task editors, drag-and-drop, Gantt charts)
- Knowledge layer / codebase indexing (the mayor explores via tools, not a pre-built index)
- Cross-rig planning (single rig per plan, can extend later)
- Plan templates or saved plans
- Automated re-planning on failure (the mayor can be asked to re-plan manually)

## Architecture

```
Dashboard UI                    Mayor Terminal (xterm.js)
┌─────────────┐                ┌──────────────────────────┐
│ Rig Detail   │               │                          │
│              │  "Plan" btn   │  Plan a convoy for:      │
│  [Plan]  ────┼──────────────>│  Rig: gastown            │
│              │  sends prompt │  Branch: main             │
│              │               │  Goal: <user types here>  │
│              │               │                          │
│              │               │  ... mayor explores ...   │
│              │               │  ... proposes tasks ...   │
│              │               │  ... user refines ...     │
│              │               │  ... user approves ...    │
│              │               │                          │
│              │               │  ✓ Created convoy 🚚     │
│              │               │  ✓ Dispatched group 1    │
└─────────────┘                └──────────────────────────┘
```

No new backend services. No new APIs beyond what xterm.js already needs. The intelligence is in the prompt template and the mayor's ability to use GT/bd commands.

## Components

### 1. Plan button on rig detail page

A button on `/rig/:name` that opens the mayor terminal with a pre-filled planning prompt. If the mayor terminal isn't already visible, it opens in a split or navigates to the mayor page.

The button sends to the mayor's tmux session:
```
tmux send-keys -t hq-mayor "<planning prompt>" Enter
```

### 2. Planning prompt template

Stored as a GT formula or embedded template. Injected with rig context:

```
I want to plan work for the {rig_name} rig.

Codebase: {git_url}
Working branch: {base_branch}
Current open beads: {open_bead_summary}

Goal: {user_goal}

Instructions:
1. Explore the codebase to understand what's relevant to this goal.
   Use shell commands: ls, cat, grep, find, git log.
2. Break the goal into concrete tasks. Each task should be one polecat's
   worth of work (a few hours, focused scope).
3. Assign each task a group number. Same group = parallel. Groups run
   sequentially (group 1 finishes before group 2 starts).
4. Present the plan as a table:

   | # | Task | Group | Priority | Description |
   |---|------|-------|----------|-------------|

5. Ask me to approve, edit, or reject.
6. On "approve" or "go":
   - Create beads: bd create "<title>" --description="<desc>" -t task -p <priority>
   - Set dependencies between groups: bd dep add <later> <earlier> --type=blocks
   - Create convoy: gt convoy create "<goal summary>" <bead-ids>
   - Dispatch group 1: gt sling <bead-id> for each bead in group 1
   - Report: "Convoy created, group 1 dispatched, waiting for group 2 deps to clear"
7. Do NOT dispatch beads from later groups until their dependencies merge.
```

### 3. Rig context injection

The prompt needs current rig state. Gathered at button-click time:

- `rig_name` — from the URL
- `git_url` — from rig config.json
- `base_branch` — from rig config.json
- `open_bead_summary` — `bd list` output (so the mayor knows what's already in flight)

This is a few CLI calls, assembled into the prompt string before sending to tmux.

### 4. Mayor terminal (dependency: xterm.js convoy)

The planning conversation happens in the mayor's interactive terminal. This depends on the xterm.js work (convoy `hq-cv-r7fyn`) being complete — the mayor page needs to be an interactive terminal, not the current chat UI.

## Implementation Order

1. **Planning prompt template** — write and test the prompt by manually pasting it into the mayor terminal. Iterate until the mayor reliably produces good plans and creates beads/convoys correctly.
2. **Plan button** — add to rig detail page. On click, gather rig context, assemble prompt, send to mayor tmux session via API endpoint.
3. **Navigation** — clicking "Plan" should show the mayor terminal so the user can interact with the planning conversation. Either navigate to /mayor or open a split view.

Step 1 is the real work — getting the prompt right. Steps 2-3 are UI wiring.

## Dependencies

- xterm.js terminal convoy (`hq-cv-r7fyn`) — interactive mayor terminal
- Convoy cross-rig tracking fix (already shipped) — so created convoys track beads correctly

## Risks

- **Mayor quality.** The plan is only as good as the mayor's ability to explore the codebase and decompose goals. If the mayor produces bad plans, the user has to manually fix them in the conversation.
- **Long planning conversations.** Complex goals might need many back-and-forth turns. Context limits could be an issue. Mitigation: keep the prompt focused, let the user break big goals into smaller planning sessions.
- **Bead creation errors.** If `bd create` or `bd dep add` fails mid-plan (Dolt hiccup), the plan is partially created. Mitigation: the mayor should verify each command succeeded before proceeding.

## Future Extensions

- **Plan from anywhere.** A top-level "Plan" button that asks which rig to target.
- **Plan review UI.** Show the proposed plan as a visual task board before the mayor creates beads. User drags tasks between groups, edits descriptions.
- **Plan templates.** Save successful plans as templates for similar goals.
- **Auto-re-plan.** When a convoy stalls (polecat stuck, tests failing), the mayor proposes a revised plan.
- **Cross-rig planning.** A single goal that spans multiple rigs, with the mayor creating beads in each rig's DB.
