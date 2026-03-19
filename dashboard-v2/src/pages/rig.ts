import { getRig, getRigRepoInfo, getMergeQueue } from "../data/rigs.js";
import { listConvoys } from "../data/convoys.js";
import { listAgentsForRig } from "../data/agents.js";
import { getEventsForRig } from "../data/events.js";
import { escapeHtml, statusBadge, priorityLabel, breadcrumbs } from "./helpers.js";

export async function renderRigPage(name: string): Promise<string> {
  let rig;
  try {
    rig = await getRig(name);
  } catch {
    rig = undefined;
  }

  if (!rig) {
    return `<div class="prose"><h1>Rig Not Found</h1><p>No rig named "${escapeHtml(name)}".</p></div>`;
  }

  const [allConvoys, agents, events, repoInfo, mqItems] = await Promise.all([
    listConvoys().catch(() => []),
    listAgentsForRig(name).catch(() => []),
    getEventsForRig(name, "1h").catch(() => []),
    getRigRepoInfo(name).catch(() => undefined),
    getMergeQueue(name).catch(() => []),
  ]);

  // Repo info for header
  const repoUrl = repoInfo?.url ?? "";
  const displayUrl = repoUrl.replace(/\.git$/, "").replace(/^https?:\/\//, "");
  const repoLink = repoUrl
    ? `<a href="${escapeHtml(repoUrl.replace(/\.git$/, ""))}" class="link link-hover text-sm font-mono" target="_blank" rel="noopener">${escapeHtml(displayUrl)}</a>`
    : `<span class="text-base-content/50 text-sm">no remote</span>`;
  const branchBadge = repoInfo?.branch
    ? `<span class="badge badge-outline badge-sm font-mono">${escapeHtml(repoInfo.branch)}</span>`
    : "";

  // Merge queue section
  const mqSection = mqItems.length > 0
    ? `<div class="overflow-x-auto">
        <table class="table table-sm">
          <thead><tr><th>ID</th><th>Issue</th><th>Worker</th><th>Status</th></tr></thead>
          <tbody>${mqItems.map((m) => `
            <tr>
              <td class="font-mono text-xs">${escapeHtml(m.id)}</td>
              <td>${m.issue ? escapeHtml(m.issue) : "—"}</td>
              <td>${m.worker ? escapeHtml(m.worker) : "—"}</td>
              <td>${statusBadge(m.status)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`
    : `<p class="text-base-content/50 text-sm">Queue empty</p>`;

  const convoyCards = allConvoys.length > 0
    ? allConvoys.map((c) => `
      <a href="/convoy/${encodeURIComponent(c.id)}" class="card bg-base-200 shadow-sm hover:shadow-md transition-shadow">
        <div class="card-body p-4">
          <h3 class="card-title text-sm">${escapeHtml(c.name)}</h3>
          <div class="flex gap-2 text-xs">
            ${statusBadge(c.status)}
            <span class="badge badge-ghost badge-xs">${c.total ?? c.tracked?.length ?? c.issues?.length ?? 0} beads</span>
          </div>
        </div>
      </a>`).join("")
    : `<p class="text-base-content/50 text-sm">No convoys</p>`;

  const agentRows = agents.length > 0
    ? agents.map((a) => `
      <tr>
        <td><a href="/agent/${encodeURIComponent(a.name)}" class="link link-hover">${escapeHtml(a.name)}</a></td>
        <td>${escapeHtml(a.role)}</td>
        <td>${statusBadge(a.status ?? "unknown")}</td>
      </tr>`).join("")
    : `<tr><td colspan="3" class="text-base-content/50">No agents</td></tr>`;

  const recentEvents = events.slice(0, 20);
  const eventItems = recentEvents.length > 0
    ? recentEvents.map((e) => `
      <li class="text-xs py-1 border-b border-base-300">
        <span class="font-mono text-base-content/50">${escapeHtml(e.timestamp)}</span>
        <span class="font-semibold">${escapeHtml(e.source)}</span>
        ${e.detail ? escapeHtml(e.detail) : ""}
      </li>`).join("")
    : `<li class="text-base-content/50 text-sm">No recent activity</li>`;

  return `
${breadcrumbs([{ label: "Gas Town", href: "/" }, { label: rig.name }])}

<div class="mb-6">
  <h1 class="text-2xl font-bold">Rig: ${escapeHtml(rig.name)}</h1>
  <div class="flex flex-wrap items-center gap-2 mt-1">
    ${repoLink} ${branchBadge}
  </div>
</div>

<div class="stats shadow mb-6">
  <div class="stat">
    <div class="stat-title">Status</div>
    <div class="stat-value text-lg">${statusBadge(rig.status)}</div>
  </div>
  <div class="stat">
    <div class="stat-title">Polecats</div>
    <div class="stat-value text-lg">${rig.polecats}</div>
  </div>
  <div class="stat">
    <div class="stat-title">Crew</div>
    <div class="stat-value text-lg">${rig.crew}</div>
  </div>
  <div class="stat">
    <div class="stat-title">Witness</div>
    <div class="stat-value text-lg">${statusBadge(rig.witness)}</div>
  </div>
  <div class="stat">
    <div class="stat-title">Refinery</div>
    <div class="stat-value text-lg">${statusBadge(rig.refinery)}</div>
  </div>
</div>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div class="lg:col-span-2">
    <h2 class="text-lg font-bold mb-3">Merge Queue</h2>
    ${mqSection}

    <h2 class="text-lg font-bold mt-6 mb-3">Convoys</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      ${convoyCards}
    </div>

    <h2 class="text-lg font-bold mt-6 mb-3">Agents</h2>
    <div class="overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr><th>Name</th><th>Role</th><th>Status</th></tr>
        </thead>
        <tbody>${agentRows}</tbody>
      </table>
    </div>
  </div>

  <div>
    <h2 class="text-lg font-bold mb-3">Activity</h2>
    <ul class="list-none p-0 m-0">${eventItems}</ul>
  </div>
</div>`;
}
