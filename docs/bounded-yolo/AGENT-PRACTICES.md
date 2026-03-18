# Agent Practices

Guidelines for working with AI agents on this project. Referenced from AGENTS.md.

## Dependency Integration

- **Read the docs first.** Before building a workaround for a missing feature, check if the dependency already supports it. Read the official documentation, not just `--help` output.
- **Maintain a capabilities reference.** For key dependencies (Kiro CLI, beads, etc.), keep a doc listing what they support. See `KIRO-CAPABILITIES.md`.
- **Ask "does X already support this?" before building.** When proposing a workaround, verify the tool doesn't already handle the use case natively.
- **Check the config, not just the code.** Features may be disabled in config (`SupportsHooks: false`) even when the tool supports them. Question the config.

## Testing

- **Write the failing test first.** Negative tests prove the gap exists. When the fix lands, flip the assertion.
- **Every fix needs a guard test.** Assert the fix doesn't break the happy path.
- **Mock at the boundary.** Fake external commands (tmux, bd, gt) with shell scripts. Don't mock internal functions.
- **Tests must be deterministic.** No real tmux sessions or Dolt queries in unit tests.
- **Test names document intent.** `TestCheckPolecatHealth_MissesValidationException` tells you what's tested.

## Verification

- **Validate before acting.** Pre-flight checks before spawning work. Fail fast with actionable guidance.
- **The daemon is the safety net.** Health checks, recovery, and lifecycle decisions belong in the heartbeat loop.
- **Check for sickness, not just death.** Inspect session content, not just existence.
- **Two-phase recovery.** Nudge first, kill on next heartbeat if still stuck.

## Working with Kiro CLI

- **Use native features.** Steering files for project context, skills for role instructions, hooks for lifecycle events, knowledge bases for docs. See `KIRO-CAPABILITIES.md`.
- **Hooks are the event system.** Stop hook fires at turn boundaries — use it for nudge delivery, not tmux injection.
- **Steering over AGENTS.md.** For project-specific context that doesn't need to be in every agent's instructions, use `.kiro/steering/` files.
- **CI=true in agent sessions.** Suppresses npm/npx interactive prompts that hang autonomous agents.
