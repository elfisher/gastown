# Goal: Interactive Planning Mode

## Intent

Add a `kiro-swarm plan` command that starts an interactive conversation between the human and the LLM to produce a SPEC.md. The human steers intent, the LLM explores the codebase and proposes structure. The conversation continues until the human approves, then the spec becomes the input for session execution.

This replaces the current one-shot planner (goal → tasks) with a two-phase approach: interactive spec → task decomposition.

## User Flow

```
$ kiro-swarm plan "add branch management"

🤔 Let me understand the codebase first...
[reads ROUTING.md, overview.md, relevant module skeletons]

Here's my initial understanding of what's needed:
- ...
- ...

What aspects are most important to you?
> I want sessions to stay on branches so I can experiment

[back and forth — human refines, LLM proposes]

Here's the draft spec:
[shows SPEC.md preview]

Ready to critique. Current reviewers:
  1. PM
  2. Architect
  3. Designer

Add, remove, or start? (add/remove/go)
> go

Debating with 3 reviewers...
[shows consensus flags]

Accept these? (y/n/edit per item)
> y

[incorporates accepted flags, shows updated spec]

Approve this spec? (y/n/edit)
> y

✅ Saved to docs/goals/branch-management.md
Start a session with this spec? (y/n)
> y
```

## Design Constraints

### 1. Interactive and iterative

Not one-shot. The human and LLM go back and forth. The LLM asks clarifying questions. The human can redirect.

### 2. Structured process

**Step 1: Braindump** — user describes what they want in natural language.

**Step 2: Context sweep** — system reads ROUTING.md, overview.md, relevant module skeletons (AST-derived function signatures), CONVENTIONS.md, COMMANDS.md, PRINCIPLES.md, LEARNINGS.md. Grounds the plan in the project's reality. Shows the user what it found. Uses MCP tools to read specific files when needed.

**Step 3: Draft + Debate critique** — system drafts the spec and runs it through a reviewer debate.

Default reviewers:
- PM: scope creep? phasing? missing flows? default behavior questions?
- Architect: state changes? reliability? testability? module boundaries?
- Designer: CLI output format? consistency with existing commands? error UX?

Before the debate starts, the user can customize reviewers:

```
Ready to critique. Current reviewers:
  1. PM
  2. Architect
  3. Designer

Add, remove, or start? (add/remove/go)
> add

Describe the reviewer:
> SRE who's been paged at 3am for this system

Current reviewers:
  1. PM
  2. Architect
  3. Designer
  4. SRE who's been paged at 3am for this system

Add, remove, or start? (add/remove/go)
> remove 2

Current reviewers:
  1. PM
  2. Designer
  3. SRE who's been paged at 3am for this system

Add, remove, or start? (add/remove/go)
> go
```

The debate is a multi-turn conversation where personas challenge each other:

```
PM: "Phase 2 is too big — merge + interactive selector + cleanup in one phase."
Architect: "Disagree — they're tightly coupled. Splitting means testing partial merge states."
PM: "Fair, but verification needs per-sub-step checks then."
Designer: "The interactive selector UX is underspecified. What happens on empty list?"
```

Debate continues until consensus (no new flags for 1-2 rounds) or max rounds hit. Only consensus flags surface to the user:

```
Consensus:
⚠️ High: Add edge case: no unmerged sessions
⚠️ Medium: Phase 2 verification needs sub-step checks
✅ Phase 2 scope is fine as-is

Accept these? (y/n/edit per item)
```

Implementation: one LLM conversation with multiple system-prompted "speakers." Each round generates the next speaker's response given debate history. Self-filtering — weak flags get dismissed by other personas.

**Step 4: Iterate** — system incorporates accepted flags, presents updated spec. Loop until user approves. Each round can trigger another debate if the user wants.

**Step 5: Verification contract** — before finalizing, explicitly shift to "definition of done":
- Generate machine-testable verification commands
- Generate behavioral checklist (each item must be verifiable by script)
- Generate edge cases
- Add smoke test (end-to-end scenario)
- Add regression test plan
- Add implementation integrity guard (don't overfit to verification)
- Add test isolation requirements
- Recommend testing approaches based on feature type:

  | Feature type | Recommended approach |
  |---|---|
  | State management / lifecycle | Property-based testing |
  | IPC / API contracts | Contract testing |
  | CLI output / display | Snapshot / golden file testing |
  | Process management | Chaos testing |
  | Data transformation | Property-based |
  | Integration flows | End-to-end smoke test |
  | Bug fixes | Regression test |

- For each behavioral checklist item, specify: automated test, smoke test, or manual verification
- Tests must exercise real behavior, not just check source patterns
- User reviews and tightens any subjective items

**Step 6: Finalize** — write SPEC.md to disk. Ask "Start a session with this spec? (y/n)". If yes, run `kiro-swarm --spec <path>` automatically.

### 3. Spec is the artifact

The output is a SPEC.md, not a task list. Task decomposition happens separately during session execution.

### 4. Spec shapes execution

The spec includes anti-goals, verification commands, edge cases, and state changes. These flow through to agents:
- Anti-goals become constraints in agent prompts
- Verification commands become acceptance criteria
- The full spec is shared with every agent as context
- Relevant module skeletons are injected per-task

### 5. Context for agents

Each agent in the swarm gets:
- Its specific task description
- The full spec (broader picture)
- Relevant module knowledge + AST skeletons (via context-builder)
- Conventions, learnings, commands
- Principles
- NOT other agents' task details

### 6. Spec template

```markdown
# [Feature] - Specification

## Intent
Objective: [what and why]
User Flow: [CLI commands and expected output]
Anti-Goals: [what the swarm must NOT build]

## Execution Phases
[ordered phases with verification per phase]

## Blueprint
State Changes: [registry.json, state.json, new files]
System Guardrails: [which modules to extend vs create]
CLI Contract: [exact flags, commands, output format]

## Verification
Automated Commands: [fast, deterministic checks]
Behavioral Checklist: [machine-testable items]
Edge Cases: [what-ifs]
Smoke Test: [end-to-end scenario — no commands that spawn full swarm runs]
```

### 7. Planner has MCP tools

During the interactive conversation, the planner has access to MCP tools (read_file, list_directory, run_command) to explore the codebase. This grounds proposals in actual code, not just knowledge summaries.

### 8. Visual scenario walkthroughs

The planning conversation converges on design through concrete examples, not abstract requirements. The LLM should:
- Mock up or visually describe outputs (CLI output, UI states, data structures, API responses) wherever possible
- Walk through end-to-end scenarios step by step, showing what the user sees at each point
- Explore edge cases by playing through them: "what happens when two sessions both need input?"
- Let the user react to concrete examples and redirect — this is faster and more precise than describing requirements abstractly
- Iterate on the design by showing updated mockups after each round of feedback

The goal is to make the design feel real before any code is written.

During the interactive conversation, the planner has access to MCP tools (read_file, list_directory, run_command) to explore the codebase. This grounds proposals in actual code, not just knowledge summaries.

## Anti-Goals

- Don't build a full TUI chat interface — use simple readline
- Don't auto-decompose specs into tasks during planning — that's execution
- Don't require specs for simple goals — `kiro-swarm "fix the bug"` still works without a spec
- Don't version or diff specs — they're point-in-time documents
- Don't make the debate mandatory — `go` with defaults should be fast

## Resolved Questions

- Task decomposition is automatic after spec approval (user confirms with y/n)
- Full spec goes to every agent as context
- Planner has MCP tools during the conversation
- Planner reads ROUTING.md + skeletons from the knowledge layer during context sweep
