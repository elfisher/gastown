# Principles

These guide how we reason about work. They are values to weigh, not rules to follow.

## Doing Work
- Understand before acting.
- Prefer minimal, focused changes. Scope matters more than completeness.
- Evidence over claims. What changed in the code is the source of truth.
- Fix the cause, not the symptom. When a fix doesn't work, step back and understand the problem before trying again.
- When the answer is obvious, act. When it's ambiguous, reason.

## Planning
- Simpler plans are better plans. Each piece of work should be verifiable on its own.
- Verify against the goal, not the plan. The plan was a guess — the goal is the truth.
- Plan for failure modes. In a multi-agent system, partial failure is the norm, not the exception.

## System Design
- The daemon is the safety net. Health checks, recovery, and lifecycle decisions belong in the heartbeat loop. Don't rely on agents being alive to self-heal.
- Check for sickness, not just death. A session can be alive but non-functional. Inspect state, not just existence.
- Validate before acting. Fail fast with actionable guidance instead of retrying on broken config.
- Agent-agnostic by default. No hardcoded runtime assumptions. Config wins over defaults.
- Two-phase recovery. Nudge first, kill on next heartbeat if still stuck. Never kill without giving the agent a chance.
- State should be explicit and inspectable. If you can't observe what the system believes, you can't debug what it does.
- Reliability beats cleverness. A predictable agent is more valuable than a brilliant but fragile one.
- Errors should guide, not just report. A good error message tells you what to do next.

## Quality
- Leave things better than you found them.
- The one who does the work shouldn't be the only one who checks it.
- Prefer idempotent operations. Agents may retry, and the system should tolerate it gracefully.

## Learning
- Learn from what went wrong. Document what you learn so the next time is smarter.
- Agent failures are system learnings. When an agent fails, ask what the orchestration missed.
