import type { Agent } from "../data/schemas.js";
import { linkify } from "./linkify.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ROLE_ICONS: Record<string, string> = {
  mayor: "🎩",
  deacon: "🐺",
  witness: "🦉",
  refinery: "🏭",
  polecat: "😺",
  crew: "👤",
  boot: "🚀",
};

const STATUS_BADGE: Record<string, string> = {
  working: "badge-primary",
  idle: "badge-ghost",
  dead: "badge-error",
};

function elapsedTime(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function renderAgentCard(agent: Agent): string {
  const icon = ROLE_ICONS[agent.role] ?? "❓";
  const badge = STATUS_BADGE[agent.status] ?? "badge-ghost";
  const preview = agent.preview
    ? `<pre class="text-xs opacity-70 mt-2 whitespace-pre-wrap max-h-24 overflow-hidden">${escapeHtml(agent.preview)}</pre>`
    : "";

  return `<a href="/agent/${encodeURIComponent(agent.session)}" class="card bg-base-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer no-underline">
    <div class="card-body p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-lg">${icon}</span>
          <span class="font-semibold">${escapeHtml(agent.name)}</span>
        </div>
        <span class="badge ${badge} badge-sm">${escapeHtml(agent.status)}</span>
      </div>
      <div class="text-xs text-base-content/60 mt-1">
        <span>${escapeHtml(agent.rig)}</span>
        <span class="mx-1">·</span>
        <span>${escapeHtml(agent.role)}</span>
        <span class="mx-1">·</span>
        <span>${elapsedTime(agent.startedAt)}</span>
      </div>
      ${agent.currentWork ? `<div class="text-xs mt-1"><span class="badge badge-outline badge-xs">${linkify(escapeHtml(agent.currentWork))}</span></div>` : ""}
      ${preview}
    </div>
  </a>`;
}

function renderGroup(title: string, agents: Agent[]): string {
  if (agents.length === 0) return "";
  return `<div class="mb-6">
    <h2 class="text-lg font-semibold mb-3">${escapeHtml(title)}</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      ${agents.map(renderAgentCard).join("\n")}
    </div>
  </div>`;
}

export function renderAgentCards(agents: Agent[]): string {
  const system = agents.filter((a) =>
    ["mayor", "deacon", "witness", "refinery", "boot"].includes(a.role)
  );
  const workers = agents.filter((a) =>
    ["polecat", "crew"].includes(a.role)
  );

  return `${renderGroup("System Agents", system)}${renderGroup("Worker Agents", workers)}`;
}

export function renderAgentsPage(agents: Agent[]): string {
  return `<div>
    <div class="flex items-center gap-2 mb-4">
      <h1 class="text-2xl font-bold">🤖 Agents</h1>
      <span class="badge badge-sm badge-ghost">${agents.length} active</span>
    </div>
    <div id="agents-grid"
         hx-get="/api/agents"
         hx-trigger="every 5s"
         hx-swap="innerHTML">
      ${renderAgentCards(agents)}
    </div>
  </div>`;
}

export function renderAgentOutput(output: string): string {
  return `<pre class="text-sm whitespace-pre-wrap font-mono bg-base-300 p-4 rounded-box overflow-auto max-h-[60vh]">${escapeHtml(output)}</pre>`;
}

export function renderAgentDetailPage(agent: Agent, output: string): string {
  const icon = ROLE_ICONS[agent.role] ?? "❓";
  const badge = STATUS_BADGE[agent.status] ?? "badge-ghost";

  return `<div>
    <div class="flex items-center gap-3 mb-4">
      <span class="text-3xl">${icon}</span>
      <div>
        <h1 class="text-2xl font-bold">${escapeHtml(agent.name)}</h1>
        <div class="text-sm text-base-content/60">
          ${escapeHtml(agent.rig)} · ${escapeHtml(agent.role)} · session: ${escapeHtml(agent.session)}
        </div>
      </div>
      <span class="badge ${badge}">${escapeHtml(agent.status)}</span>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
      <div class="stat bg-base-200 rounded-box p-4">
        <div class="stat-title">Started</div>
        <div class="stat-value text-sm">${elapsedTime(agent.startedAt)} ago</div>
      </div>
      <div class="stat bg-base-200 rounded-box p-4">
        <div class="stat-title">Last Activity</div>
        <div class="stat-value text-sm">${elapsedTime(agent.lastActivity)} ago</div>
      </div>
      <div class="stat bg-base-200 rounded-box p-4">
        <div class="stat-title">Runtime</div>
        <div class="stat-value text-sm">${escapeHtml(agent.runtime ?? "default")}</div>
      </div>
    </div>

    ${agent.currentWork ? `<div class="mb-4"><span class="badge badge-outline">${linkify(escapeHtml(agent.currentWork))}</span></div>` : ""}

    <div class="mb-2 flex items-center gap-2">
      <h2 class="text-lg font-semibold">Live Output</h2>
      <span class="badge badge-sm badge-ghost">htmx polling</span>
    </div>
    <div id="agent-output"
         hx-get="/api/agents/${encodeURIComponent(agent.session)}/output"
         hx-trigger="every 3s"
         hx-swap="innerHTML">
      ${renderAgentOutput(output)}
    </div>
  </div>`;
}
