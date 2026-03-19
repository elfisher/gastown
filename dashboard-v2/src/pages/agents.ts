import type { Agent, AgentWorkHistoryEntry } from "../data/schemas.js";
import { breadcrumbs } from "./helpers.js";

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
  recovering: "badge-warning",
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
      ${agent.currentWork ? `<div class="text-xs mt-1"><span class="badge badge-outline badge-xs">${escapeHtml(agent.currentWork)}</span></div>` : ""}
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

export function renderAgentDetailPage(agent: Agent, output: string, workHistory: AgentWorkHistoryEntry[] = []): string {
  const icon = ROLE_ICONS[agent.role] ?? "❓";
  const badge = STATUS_BADGE[agent.status] ?? "badge-ghost";

  const sessionInfoRows: string[] = [];
  if (agent.workingDir) sessionInfoRows.push(`<tr><td class="font-medium pr-4">Working Dir</td><td class="font-mono text-xs">${escapeHtml(agent.workingDir)}</td></tr>`);
  if (agent.gitBranch) sessionInfoRows.push(`<tr><td class="font-medium pr-4">Git Branch</td><td class="font-mono text-xs">${escapeHtml(agent.gitBranch)}</td></tr>`);
  if (agent.pid) sessionInfoRows.push(`<tr><td class="font-medium pr-4">PID</td><td class="font-mono text-xs">${agent.pid}</td></tr>`);

  const sessionInfoHtml = sessionInfoRows.length > 0
    ? `<div class="mb-4">
        <h2 class="text-lg font-semibold mb-2">Session Info</h2>
        <table class="table table-xs bg-base-200 rounded-box"><tbody>${sessionInfoRows.join("")}</tbody></table>
      </div>`
    : "";

  const workHistoryHtml = workHistory.length > 0
    ? `<div class="mb-4">
        <h2 class="text-lg font-semibold mb-2">Work History</h2>
        <div class="overflow-x-auto"><table class="table table-xs bg-base-200 rounded-box">
          <thead><tr><th>Bead</th><th>Title</th><th>Closed</th></tr></thead>
          <tbody>${workHistory.map((w) => `<tr>
            <td><a href="/bead/${encodeURIComponent(w.id)}" class="link link-hover font-mono text-xs">${escapeHtml(w.id)}</a></td>
            <td class="text-xs">${escapeHtml(w.title)}</td>
            <td class="text-xs opacity-60">${w.closedAt ? elapsedTime(w.closedAt) + " ago" : ""}</td>
          </tr>`).join("")}</tbody>
        </table></div>
      </div>`
    : "";

  return `<div>
    ${breadcrumbs([{ label: "Gas Town", href: "/" }, { label: "Agents", href: "/agents" }, { label: agent.name }])}
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

    ${agent.currentWork ? `<div class="mb-4"><span class="text-lg font-semibold mr-2">Hooked:</span><span class="badge badge-primary badge-lg">${escapeHtml(agent.currentWork)}</span></div>` : ""}

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

    ${agent.currentWork ? `<div class="mb-4"><span class="badge badge-outline">${escapeHtml(agent.currentWork)}</span></div>` : ""}
    ${sessionInfoHtml}
    ${workHistoryHtml}

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
