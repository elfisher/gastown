# Kiro CLI Capabilities for Gas Town

Reference for what Kiro natively supports. Check this before building workarounds.

Source: https://kiro.dev/docs/cli/

## Hooks (lifecycle events)

Kiro supports hooks at these trigger points:
- **AgentSpawn** — when agent is activated. STDOUT added to context.
- **UserPromptSubmit** — when user submits a prompt. STDOUT added to context.
- **PreToolUse** — before tool execution. Can block (exit 2). Supports matchers.
- **PostToolUse** — after tool execution. Supports matchers.
- **Stop** — when assistant finishes responding (end of each turn). STDOUT captured but NOT added to context.

Config: `.kiro/agents/<name>.json` → `hooks` field. Timeout: 30s default, configurable via `timeout_ms`.

**GT integration:** Stop hook runs `gt signal kiro-stop` to deliver queued nudges. AgentSpawn runs `gt prime --hook`. UserPromptSubmit runs `gt mail check --inject`.

**Key difference from Claude Code:** Kiro's Stop hook stdout is NOT injected into context. Use tmux send-keys for message delivery. Claude Code's Stop hook returns JSON block/approve that controls the turn.

## Custom Agents

Kiro supports custom agent profiles with:
- **prompt** — system prompt (inline or file:// URI)
- **tools** — which tools are available (built-in + MCP)
- **allowedTools** — tools that don't require permission
- **toolsSettings** — per-tool config (allowed paths, commands)
- **resources** — files, skills, knowledge bases loaded into context
- **hooks** — lifecycle hooks (see above)
- **model** — model selection
- **keyboardShortcut** — quick agent switching

Config: `.kiro/agents/<name>.json` (local) or `~/.kiro/agents/<name>.json` (global).

**GT integration:** GT installs a `gastown.json` agent config with hooks. Could also use this to set tool restrictions, resources, and model per-role.

## Steering Files

Persistent project knowledge in `.kiro/steering/*.md`:
- **product.md** — product overview, target users, business objectives
- **tech.md** — frameworks, libraries, tools, constraints
- **structure.md** — file organization, naming conventions, architecture

Automatically loaded in every chat session. Custom agents need explicit `resources` config to include them.

**GT opportunity:** Our PRINCIPLES.md, TESTING.md, and role-specific instructions could be steering files instead of (or in addition to) AGENTS.md. Steering files are purpose-built for this — AGENTS.md is a convention, steering is a native feature.

## Agent Skills

Portable instruction packages in `.kiro/skills/<name>/SKILL.md`:
- Auto-activate based on description matching
- Support reference files for detailed docs
- Workspace-scoped or global

**GT opportunity:** GT roles (witness patrol, refinery merge, polecat work) could be skills. Instead of injecting role instructions via beacon/prompt, define them as skills that activate based on the task. "Review this PR" → pr-review skill activates. "Run patrol" → witness-patrol skill activates.

## Knowledge Bases

Index large documentation sets for agent search:
```json
{
  "resources": [{
    "type": "knowledgeBase",
    "source": "file://./docs",
    "name": "ProjectDocs",
    "autoUpdate": true
  }]
}
```

**GT opportunity:** The knowledge pipeline (Goal 4) could use Kiro's native knowledge base indexing instead of building custom summarization. Index the codebase docs, let Kiro search them natively.

## MCP Integration

Connect external tools via Model Context Protocol:
```json
{
  "mcpServers": {
    "git": { "command": "git-mcp", "args": [] }
  }
}
```

**GT opportunity:** GT commands (`gt status`, `bd list`, `gt convoy list`) could be exposed as MCP tools instead of requiring agents to shell out. This would be faster than CLI invocation and give Kiro structured data.

## What GT Currently Uses vs What's Available

| Capability | GT uses | Kiro offers | Gap |
|---|---|---|---|
| Lifecycle hooks | ✅ Just added | Stop, Spawn, Prompt, PreTool, PostTool | None now |
| Agent config | Partial (hooks only) | Full (tools, resources, model, prompt) | Could restrict tools per role |
| Steering files | AGENTS.md only | `.kiro/steering/*.md` (native) | Could use for PRINCIPLES, TESTING |
| Skills | Not used | Auto-activating instruction packages | Could define role-specific skills |
| Knowledge bases | Not used | Native indexing + search | Could replace custom knowledge pipeline |
| MCP tools | Not used | Structured tool interface | Could expose GT/bd as MCP server |
| Tool restrictions | Not used | allowedTools, toolsSettings | Could restrict polecats from dangerous ops |
| Model selection | `--model` flag | Per-agent model config | Could set different models per role |
