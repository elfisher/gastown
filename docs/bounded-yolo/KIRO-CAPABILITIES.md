# Kiro CLI Capabilities

Reference for what Kiro CLI natively supports. Consult this before building Kiro-specific workarounds.

**How to learn about Kiro's capabilities:**
- Docs: https://kiro.dev/docs/cli/
- Key pages: [Hooks](https://kiro.dev/docs/cli/hooks/), [Custom Agents](https://kiro.dev/docs/cli/custom-agents/configuration-reference/), [Steering](https://kiro.dev/docs/cli/steering/), [Skills](https://kiro.dev/docs/cli/skills/), [MCP](https://kiro.dev/docs/cli/mcp/)
- CLI help: `kiro-cli chat --help` (covers flags, not hooks/agents/steering)
- In-session: `/agent`, `/context show`, `/model`

**When to check these docs:** Before building any workaround for a perceived Kiro limitation. The idle agent problem cost us two days of daemon-level tmux injection work before we discovered Kiro already had stop hooks.

## Hooks

Lifecycle events that fire at specific points during agent operation.

| Hook | When it fires | STDOUT behavior |
|---|---|---|
| AgentSpawn | Agent is activated | Added to context |
| UserPromptSubmit | User submits a prompt | Added to context |
| PreToolUse | Before tool execution (can block) | Not added to context |
| PostToolUse | After tool execution | Not added to context |
| Stop | Assistant finishes responding (end of turn) | Captured but NOT added to context |

Config: `.kiro/agents/<name>.json` → `hooks` field.

**GT integration:** GT installs a `gastown.json` agent config with hooks via the template system (`internal/hooks/templates/kiro/`). Stop hook calls `gt signal kiro-stop`. AgentSpawn calls `gt prime --hook`. UserPromptSubmit calls `gt mail check --inject`.

**Key difference from Claude Code:** Kiro's Stop hook stdout is NOT injected into context. GT uses tmux send-keys for message delivery at turn boundaries. Claude Code's Stop hook returns JSON block/approve that controls the turn directly.

## Custom Agents

Agent profiles defined in `.kiro/agents/<name>.json`. Support:
- `prompt` — system prompt (inline or file:// URI)
- `tools` — available tools (built-in + MCP)
- `allowedTools` — tools that don't require permission
- `toolsSettings` — per-tool config (allowed paths, commands)
- `resources` — files, skills, knowledge bases
- `hooks` — lifecycle hooks
- `model` — model selection
- `keyboardShortcut` — quick switching

GT uses this for hook installation. The agent config could also be used for tool restrictions per role, but GT handles role differentiation generally via role templates.

## Steering Files

Persistent project knowledge in `.kiro/steering/*.md`. Automatically loaded in every default agent session. Custom agents need explicit `resources` config.

GT uses AGENTS.md (which Kiro reads natively) for project context. Steering files are an alternative discovery mechanism but the content should stay in agent-agnostic docs.

## Skills

Auto-activating instruction packages in `.kiro/skills/<name>/SKILL.md`. Activate based on description matching against user requests.

GT handles role-specific instructions via role prompt templates (`internal/templates/roles/`), which work across all runtimes. Skills are Kiro-specific and would duplicate the role system.

## Knowledge Bases

Native document indexing and search. Configured in agent `resources` field.

GT's Goal 4 (knowledge pipeline) is the general solution for codebase understanding. Knowledge bases are Kiro-specific.

## MCP Integration

Model Context Protocol — a general standard (not Kiro-specific) for exposing tools to agents. Supported by Kiro, Claude Code, Cursor, and others.

**GT opportunity:** Exposing GT/bd commands as an MCP server would benefit all MCP-capable runtimes. Agents get structured data instead of parsing CLI output. Also solves dashboard performance (structured API vs CLI invocation).

## What GT Uses vs What's Available

| Capability | GT uses | Available | Notes |
|---|---|---|---|
| Hooks | ✅ Stop, Spawn, Prompt | All 5 hook types | PreToolUse could guard dangerous ops |
| Agent config | Hooks only | Full config | Could restrict tools per role |
| Steering | AGENTS.md | `.kiro/steering/` | AGENTS.md already works |
| Skills | Not used | Auto-activating | GT role templates are general solution |
| Knowledge bases | Not used | Native indexing | Goal 4 is general solution |
| MCP | Not used | Structured tools | Worth doing — general protocol |
| Tool restrictions | Not used | allowedTools | Solve in GT hooks, not Kiro config |
| Model selection | GT role_agents | Per-agent model | GT already handles this |
