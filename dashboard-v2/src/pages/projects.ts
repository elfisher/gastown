import type { ProjectItem, ProjectsData } from "../data/projects.js";
import type { Bead } from "../data/schemas.js";
import { escapeHtml, statusBadge, priorityLabel } from "./helpers.js";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function progressBar(total: number, closed: number, hooked: number): string {
  if (total === 0) return `<div class="text-xs text-base-content/40">No beads</div>`;
  const closedPct = Math.round((closed / total) * 100);
  const hookedPct = Math.round((hooked / total) * 100);
  return `<div class="w-full">
    <div class="flex justify-between text-xs mb-1">
      <span>${closed}/${total} done</span>
      <span>${closedPct}%</span>
    </div>
    <div class="w-full bg-base-300 rounded-full h-2 overflow-hidden flex">
      <div class="bg-success h-2" style="width:${closedPct}%"></div>
      <div class="bg-info h-2" style="width:${hookedPct}%"></div>
    </div>
  </div>`;
}

function renderBeadRow(bead: Bead): string {
  const assignee = bead.assignee
    ? escapeHtml(bead.assignee.split("/").pop() ?? bead.assignee)
    : "—";
  return `<tr>
    <td><a href="/bead/${encodeURIComponent(bead.id)}" class="link link-hover font-mono text-xs">${escapeHtml(bead.id)}</a></td>
    <td class="text-sm">${escapeHtml(bead.title)}</td>
    <td>${statusBadge(bead.status)}</td>
    <td>${priorityLabel(bead.priority)}</td>
    <td class="text-xs">${escapeHtml(assignee)}</td>
    <td class="text-xs text-base-content/50">${timeAgo(bead.updated_at)}</td>
  </tr>`;
}

function renderProjectCard(project: ProjectItem): string {
  const typeIcon = project.type === "convoy" ? "🚚" : "📋";
  const detailId = `proj-${project.id.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const detailLink = project.type === "convoy"
    ? `/convoy/${encodeURIComponent(project.id)}`
    : `/bead/${encodeURIComponent(project.id)}`;

  const beadTable =
    project.beads.length === 0
      ? `<p class="text-sm text-base-content/50 py-2">No child beads</p>`
      : `<div class="overflow-x-auto">
          <table class="table table-sm">
            <thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Pri</th><th>Assignee</th><th>Updated</th></tr></thead>
            <tbody>${project.beads.map(renderBeadRow).join("")}</tbody>
          </table>
        </div>`;

  return `<div class="card bg-base-100 shadow-sm border border-base-300"
    data-search="${escapeHtml((project.id + " " + project.name).toLowerCase())}">
    <div class="card-body p-4 gap-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span>${typeIcon}</span>
          <a href="${detailLink}" class="font-bold link link-hover">${escapeHtml(project.name)}</a>
          <span class="font-mono text-xs text-base-content/50">${escapeHtml(project.id)}</span>
        </div>
        ${statusBadge(project.status)}
      </div>
      ${progressBar(project.total, project.closed, project.hooked)}
      <div class="collapse collapse-arrow bg-base-200 rounded-box">
        <input type="checkbox" id="${detailId}" />
        <div class="collapse-title text-sm font-medium py-2 min-h-0">
          ${project.beads.length} beads
        </div>
        <div class="collapse-content">
          ${beadTable}
        </div>
      </div>
    </div>
  </div>`;
}

function renderFilterBar(activeSearch?: string, activeStatus?: string, activePriority?: string): string {
  const statuses = ["active", "completed", "pending"];
  const statusOpts = statuses
    .map(
      (s) =>
        `<option value="${s}" ${s === activeStatus ? "selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
    )
    .join("");

  const priorities = [
    { value: "0", label: "P0 Critical" },
    { value: "1", label: "≤ P1 High" },
    { value: "2", label: "≤ P2 Medium" },
    { value: "3", label: "≤ P3 Low" },
  ];
  const priorityOpts = priorities
    .map(
      (p) =>
        `<option value="${p.value}" ${p.value === activePriority ? "selected" : ""}>${p.label}</option>`
    )
    .join("");

  return `<div class="flex gap-2 flex-wrap">
    <input type="text" name="search" placeholder="Search projects…"
           value="${escapeHtml(activeSearch ?? "")}"
           class="input input-bordered input-sm w-48"
           oninput="(function(v){document.querySelectorAll('[data-search]').forEach(function(c){c.style.display=c.dataset.search.includes(v)?'':'none'})})(this.value.toLowerCase())" />
    <select name="status" class="select select-bordered select-sm"
            hx-get="/api/projects" hx-target="#projects-content" hx-swap="innerHTML"
            hx-include="[name='search'],[name='priority']">
      <option value="">All statuses</option>
      ${statusOpts}
    </select>
    <select name="priority" class="select select-bordered select-sm"
            hx-get="/api/projects" hx-target="#projects-content" hx-swap="innerHTML"
            hx-include="[name='search'],[name='status']">
      <option value="">All priorities</option>
      ${priorityOpts}
    </select>
  </div>`;
}

export function renderProjectsContent(data: ProjectsData): string {
  if (data.projects.length === 0) {
    return `<div class="text-center text-base-content/50 py-8">No projects found</div>`;
  }
  return `<div class="space-y-4">
    ${data.projects.map(renderProjectCard).join("\n")}
  </div>`;
}

export function renderProjectsPage(
  data: ProjectsData,
  activeSearch?: string,
  activeStatus?: string,
  activePriority?: string
): string {
  return `<div>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">📋 Project Overview</h1>
      <span class="badge badge-sm badge-ghost">${data.total} projects</span>
    </div>
    ${renderFilterBar(activeSearch, activeStatus, activePriority)}
    <div id="projects-content" class="mt-4"
         hx-get="/api/projects" hx-trigger="every 15s"
         hx-swap="innerHTML" hx-include="[name='search'],[name='status'],[name='priority']">
      ${renderProjectsContent(data)}
    </div>
  </div>`;
}
