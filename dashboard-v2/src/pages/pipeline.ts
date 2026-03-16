import type { Bead, PipelineData, StageGroup } from "../data/pipeline.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const STATUS_BADGE: Record<string, string> = {
  hooked: "badge-primary",
  open: "badge-ghost",
  closed: "badge-success",
};

const PRIORITY_LABEL: Record<number, string> = {
  0: "P0",
  1: "P1",
  2: "P2",
  3: "P3",
  4: "P4",
};

function renderBeadCard(bead: Bead): string {
  const badge = STATUS_BADGE[bead.status] ?? "badge-ghost";
  const pLabel = PRIORITY_LABEL[bead.priority] ?? `P${bead.priority}`;
  const assignee = bead.assignee
    ? escapeHtml(bead.assignee.split("/").pop() ?? bead.assignee)
    : "unassigned";

  return `<div class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body p-3 gap-1">
      <div class="flex items-center justify-between">
        <a href="/bead/${encodeURIComponent(bead.id)}" class="link link-hover text-sm font-mono">${escapeHtml(bead.id)}</a>
        <span class="badge badge-xs ${badge}">${escapeHtml(bead.status)}</span>
      </div>
      <a href="/bead/${encodeURIComponent(bead.id)}" class="link link-hover font-medium text-sm">${escapeHtml(bead.title)}</a>
      <div class="flex items-center gap-2 text-xs opacity-60">
        <span class="badge badge-xs badge-outline">${pLabel}</span>
        <span>👤 ${escapeHtml(assignee)}</span>
        <span>⏱ ${timeAgo(bead.updated_at)}</span>
      </div>
    </div>
  </div>`;
}

function renderStage(stage: StageGroup): string {
  const icon =
    stage.name === "hooked" ? "🔧" : stage.name === "closed" ? "✅" : "📋";
  const beadCards =
    stage.beads.length === 0
      ? `<div class="text-center text-base-content/40 py-4 text-sm">No work items</div>`
      : stage.beads.map(renderBeadCard).join("\n");

  return `<div class="collapse collapse-arrow bg-base-200 rounded-box">
    <input type="checkbox" checked />
    <div class="collapse-title font-medium flex items-center gap-2">
      ${icon} ${escapeHtml(stage.name.charAt(0).toUpperCase() + stage.name.slice(1))}
      <span class="badge badge-sm">${stage.beads.length}</span>
    </div>
    <div class="collapse-content space-y-2">
      ${beadCards}
    </div>
  </div>`;
}

function renderFilterBar(
  rigs: string[],
  activeRig?: string,
  activePriority?: string
): string {
  const rigOptions = rigs
    .map(
      (r) =>
        `<option value="${escapeHtml(r)}" ${r === activeRig ? "selected" : ""}>${escapeHtml(r)}</option>`
    )
    .join("");

  const prioOptions = [0, 1, 2, 3, 4]
    .map(
      (p) =>
        `<option value="${p}" ${String(p) === activePriority ? "selected" : ""}>P${p} and above</option>`
    )
    .join("");

  return `<div class="flex gap-2 flex-wrap">
    <select name="rig" class="select select-bordered select-sm"
            hx-get="/api/pipeline" hx-target="#pipeline-content" hx-swap="innerHTML"
            hx-include="[name='priority']">
      <option value="">All rigs</option>
      ${rigOptions}
    </select>
    <select name="priority" class="select select-bordered select-sm"
            hx-get="/api/pipeline" hx-target="#pipeline-content" hx-swap="innerHTML"
            hx-include="[name='rig']">
      <option value="">Any priority</option>
      ${prioOptions}
    </select>
  </div>`;
}

export function renderPipelineContent(data: PipelineData): string {
  const stats = data.stages
    .map(
      (s) =>
        `<div class="stat place-items-center">
      <div class="stat-title">${escapeHtml(s.name.charAt(0).toUpperCase() + s.name.slice(1))}</div>
      <div class="stat-value text-2xl">${s.beads.length}</div>
    </div>`
    )
    .join("");

  return `<div class="stats shadow mb-4 w-full">${stats}</div>
    <div class="space-y-3">
      ${data.stages.map(renderStage).join("\n")}
    </div>`;
}

export function renderPipelinePage(
  data: PipelineData,
  activeRig?: string,
  activePriority?: string
): string {
  return `<div>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">📊 Pipeline</h1>
      <span class="badge badge-sm badge-ghost">${data.total} items</span>
    </div>
    ${renderFilterBar(data.rigs, activeRig, activePriority)}
    <div id="pipeline-content" class="mt-4"
         hx-get="/api/pipeline" hx-trigger="every 10s"
         hx-swap="innerHTML" hx-include="[name='rig'],[name='priority']">
      ${renderPipelineContent(data)}
    </div>
  </div>`;
}
