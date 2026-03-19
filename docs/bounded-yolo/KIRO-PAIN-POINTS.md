# Kiro CLI Pain Points

Issues discovered while running Kiro as the primary agent runtime in GT. File as GitHub issues when ready.

## execute_bash can't handle interactive prompts

`execute_bash` hangs on any command that opens an interactive editor or expects stdin input. Git rebase opens vim, npm prompts for install confirmation, etc.

**Workarounds:** `GIT_EDITOR=true`, `CI=true`, `DEBIAN_FRONTEND=noninteractive`

**Ideal fix:** Interactive terminal tool (start_process / send_input / read_output) or MCP-based pty wrapper.

## Stop hook stdout not added to context

Kiro's Stop hook captures stdout but does NOT inject it into the agent's context. Claude Code's stop hook returns JSON that controls the next turn. This means GT can't deliver messages to Kiro agents via stop hook output — has to use tmux send-keys instead.

**Workaround:** `gt signal kiro-stop` checks for pending work and injects via tmux send-keys.

**Ideal fix:** Option to add stop hook stdout to context, or a structured return value that influences the next turn.

## Polecats skip gt done despite clear instructions

Kiro polecats read the formula (which says "run gt done" 8+ times), do the work, push the branch, then go idle without calling `gt done`. The lifecycle ceremony gets skipped even though the instructions are in context.

**Workaround:** Daemon detects dead sessions and re-slings. GIT_EDITOR=true prevents refinery vim hang. Idle reaper eventually cleans up.

**Ideal fix:** Stronger instruction following for multi-step workflows, or a way to enforce "must run this command before session can end."

## No way to enforce command execution before session end

There's no hook or mechanism to say "this command MUST run before the agent goes idle." The stop hook fires after the turn ends, but it can't force the agent to do something in the next turn.

**Ideal fix:** A "pre-idle" hook that can inject a required action, or a session constraint that blocks idle until a condition is met.

## Context compaction loses operational instructions

When Kiro compacts context, the formula steps and "run gt done" instructions can get summarized away. The agent loses the operational knowledge it needs to complete the lifecycle.

**Workaround:** Keep critical instructions short and repeated. GT.md and AGENTS.md are re-read on prime.

**Ideal fix:** Pinned context sections that survive compaction, or a way to mark instructions as non-compactable.
