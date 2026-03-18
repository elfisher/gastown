import { getBead } from "../data/beads.js";
import { listConvoys } from "../data/convoys.js";
import { getBeadBranchInfo, type BranchInfo } from "../data/git.js";
import { getAgentOutput } from "../data/agents.js";
import { escapeHtml, statusBadge, priorityLabel } from "./helpers.js";
import type { BeadDetail } from "../data/schemas.js";

interface BeadHistoryEntry { timestamp: string; action: string; actor?: string; detail?: string; date?: string; committer?: string; status?: string; }
async function getBeadHistory(_id: string): Promise<BeadHistoryEntry[]> { return []; }

/** Extract rig name from bead ID prefix (e.g. "gt-abc" → "gastown" via prefix lookup) */
function rigFromAssignee(assignee?: string): string | undefined {
  if (!assignee) return undefined;
  // assignee format: "gastown/polecats/furiosa" or "gastown/crew/dom"
  const parts = assignee.split("/");
  return parts[0];
}

/** Extract a metadata value from the key: value preamble in a description */
function extractMeta(description: string, key: string): string | undefined {
  for (const line of description.split("\n")) {
    const m = new RegExp(`^${key}:\\s*(.+)`).exec(line.trim());
    if (m) return m[1]!.trim();
  }
  return undefined;
}

/** Derive tmux session name from assignee path (e.g. "gastown/polecats/furiosa" → "gastown-furiosa") */
function sessionFromAssignee(assignee?: string): string | undefined {
  if (!assignee) return undefined;
  const parts = assignee.split("/");
  if (parts.length >= 3 && parts[1] === "polecats") {
    return `${parts[0]}-${parts[2]}`;
  }
  if (parts.length >= 1) {
    return `${parts[0]}-${parts[parts.length - 1]}`;
  }
  return undefined;
}

/** Parse description for checklist items (lines starting with - [ ] or - [x]) */
function parseChecklist(description: string): { text: string; checked: boolean }[] {
  const items: { text: string; checked: boolean }[] = [];
  for (const line of description.split("\n")) {
    const m = /^[-*]\s+\[([ xX])\]\s+(.+)/.exec(line.trim());
    if (m) {
      items.push({ text: m[2]!, checked: m[1] !== " " });
    }
  }
  return items;
}

/** Strip metadata preamble (key: value lines at top) from description */
function stripMetadata(description: string): string {
  const lines = description.split("\n");
  let i = 0;
  // Skip lines that look like "key: value" or "key: [value]"
  while (i < lines.length && /^[a-z_]+:/.test(lines[i]!.trim())) {
    i++;
  }
  // Skip blank lines after metadata
  while (i < lines.length && lines[i]!.trim() === "") {
    i++;
  }
  return lines.slice(i).join("\n");
}

function renderBreadcrumbs(bead: BeadDetail, rigName?: string, convoyId?: string): string {
  const crumbs = [`<a href="/" class="link link-hover">Gas Town</a>`];
  if (rigName) {
    crumbs.push(`<a href="/rig/${encodeURIComponent(rigName)}" class="link link-hover">${escapeHtml(rigName)}</a>`);
  }
  if (convoyId) {
    crumbs.push(`<a href="/convoy/${encodeURIComponent(convoyId)}" class="link link-hover">${escapeHtml(convoyId)}</a>`);
  }
  crumbs.push(`<span>${escapeHtml(bead.id)}</span>`);
  return `<div class="text-sm breadcrumbs mb-4"><ul>${crumbs.map((c) => `<li>${c}</li>`).join("")}</ul></div>`;
}

function renderTimeline(history: BeadHistoryEntry[]): string {
  if (history.length === 0) {
    return `<p class="text-base-content/50 text-sm">No history available</p>`;
  }
  const items = history.map((e) => `
    <li>
      <div class="timeline-start text-xs text-base-content/50">${escapeHtml(e.date ?? e.timestamp)}</div>
      <div class="timeline-middle"><span class="badge badge-xs badge-primary"></span></div>
      <div class="timeline-end timeline-box text-sm">
        <span class="font-semibold">${escapeHtml(e.committer ?? e.actor ?? "")}</span>
        → ${statusBadge(e.status ?? e.action)}
      </div>
      <hr/>
    </li>`).join("");
  return `<ul class="timeline timeline-vertical timeline-compact">${items}</ul>`;
}

function renderDescription(description: string): string {
  const clean = stripMetadata(description);
  if (!clean.trim()) return `<p class="text-base-content/50">No description</p>`;

  const checklist = parseChecklist(clean);
  const sections: string[] = [];

  // Render non-checklist description text
  const descLines = clean.split("\n").filter((l) => !/^[-*]\s+\[[ xX]\]/.test(l.trim()));
  const descText = descLines.join("\n").trim();
  if (descText) {
    sections.push(`<div class="whitespace-pre-wrap text-sm">${escapeHtml(descText)}</div>`);
  }

  // Render checklist as acceptance criteria
  if (checklist.length > 0) {
    const items = checklist.map((c) =>
      `<li><label class="flex items-center gap-2 cursor-default">
        <input type="checkbox" class="checkbox checkbox-sm" ${c.checked ? "checked" : ""} disabled />
        <span class="text-sm">${escapeHtml(c.text)}</span>
      </label></li>`
    ).join("");
    sections.push(`
      <h3 class="text-md font-bold mt-4 mb-2">Acceptance Criteria</h3>
      <ul class="list-none p-0 m-0 space-y-1">${items}</ul>`);
  }

  return sections.join("");
}

function renderDeps(bead: BeadDetail): string {
  const deps = bead.dependencies ?? [];
  const dependents = bead.dependents ?? [];
  if (deps.length === 0 && dependents.length === 0) return "";

  const depRows = (items: typeof deps, label: string) => {
    if (items.length === 0) return "";
    const rows = items.map((d) => `
      <tr>
        <td><a href="/bead/${encodeURIComponent(d.id)}" class="link link-hover font-mono text-xs">${escapeHtml(d.id)}</a></td>
        <td class="text-sm">${escapeHtml(d.title)}</td>
        <td>${statusBadge(d.status)}</td>
        <td>${priorityLabel(d.priority)}</td>
      </tr>`).join("");
    return `
      <h3 class="text-md font-bold mt-4 mb-2">${label}</h3>
      <div class="overflow-x-auto">
        <table class="table table-sm">
          <thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Priority</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  };

  return depRows(deps, "Depends On") + depRows(dependents, "Blocks");
}

function renderFilesChanged(info: BranchInfo): string {
  if (info.files.length === 0 && info.commits.length === 0) {
    return `<p class="text-base-content/50 text-sm">No changes found</p>`;
  }

  const totalAdd = info.files.reduce((s, f) => s + f.additions, 0);
  const totalDel = info.files.reduce((s, f) => s + f.deletions, 0);

  // Commit log
  const commitRows = info.commits.map((c) =>
    `<tr>
      <td class="font-mono text-xs">${escapeHtml(c.hash)}</td>
      <td class="text-sm">${escapeHtml(c.message)}</td>
      <td class="text-xs text-base-content/50">${escapeHtml(c.date)}</td>
    </tr>`
  ).join("");

  const commitTable = info.commits.length > 0 ? `
    <div class="mb-4">
      <p class="text-sm text-base-content/50 mb-2">${info.commits.length} commit${info.commits.length !== 1 ? "s" : ""} on <code class="text-xs">${escapeHtml(info.branch)}</code></p>
      <div class="overflow-x-auto">
        <table class="table table-sm"><tbody>${commitRows}</tbody></table>
      </div>
    </div>` : "";

  // File list with expandable diffs
  const fileRows = info.files.map((f, i) => {
    const diffId = `diff-${i}`;
    const bar = renderDiffBar(f.additions, f.deletions);
    const diffBlock = f.diff
      ? `<div id="${diffId}" class="hidden mt-2">
          <pre class="bg-base-200 rounded-lg p-3 text-xs overflow-x-auto max-h-96 whitespace-pre-wrap"><code>${colorDiff(escapeHtml(f.diff))}</code></pre>
        </div>`
      : "";
    const toggle = f.diff
      ? `onclick="document.getElementById('${diffId}').classList.toggle('hidden')" class="cursor-pointer hover:bg-base-200 rounded"`
      : "";
    return `
      <div ${toggle}>
        <div class="flex items-center gap-2 py-1 px-2">
          ${f.diff ? `<span class="text-xs text-base-content/30">▶</span>` : ""}
          <span class="font-mono text-sm flex-1">${escapeHtml(f.file)}</span>
          <span class="text-success text-xs">+${f.additions}</span>
          <span class="text-error text-xs">-${f.deletions}</span>
          ${bar}
        </div>
        ${diffBlock}
      </div>`;
  }).join("");

  return `
    ${commitTable}
    <div class="flex items-center gap-3 mb-2">
      <span class="text-sm font-semibold">${info.files.length} file${info.files.length !== 1 ? "s" : ""} changed</span>
      <span class="text-success text-xs">+${totalAdd}</span>
      <span class="text-error text-xs">-${totalDel}</span>
    </div>
    <div class="divide-y divide-base-200">${fileRows}</div>`;
}

/** Tiny colored bar showing add/delete ratio */
function renderDiffBar(add: number, del: number): string {
  const total = add + del;
  if (total === 0) return "";
  const boxes = 5;
  const addBoxes = Math.round((add / total) * boxes);
  const delBoxes = boxes - addBoxes;
  return `<span class="inline-flex gap-px">${"<span class=\"inline-block w-2 h-2 bg-success rounded-sm\"></span>".repeat(addBoxes)}${"<span class=\"inline-block w-2 h-2 bg-error rounded-sm\"></span>".repeat(delBoxes)}</span>`;
}

/** Add color spans to diff lines (already HTML-escaped) */
function colorDiff(escaped: string): string {
  return escaped.split("\n").map((line) => {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      return `<span class="text-success">${line}</span>`;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      return `<span class="text-error">${line}</span>`;
    }
    if (line.startsWith("@@")) {
      return `<span class="text-info">${line}</span>`;
    }
    return line;
  }).join("\n");
}

function renderAgentOutputSection(output: string): string {
  if (!output || output === "(session not available)") {
    return `<p class="text-base-content/50 text-sm">No active session</p>`;
  }
  return `<pre class="bg-base-200 rounded-lg p-4 text-xs overflow-x-auto max-h-96 whitespace-pre-wrap"><code>${escapeHtml(output)}</code></pre>`;
}

export async function renderBeadPage(id: string): Promise<string> {
  let bead: BeadDetail;
  try {
    bead = await getBead(id);
  } catch {
    return `<div class="prose"><h1>Bead Not Found</h1><p>No bead with ID "${escapeHtml(id)}".</p></div>`;
  }

  // Find convoy containing this bead
  let convoyId: string | undefined;
  try {
    const convoys = await listConvoys();
    const match = convoys.find((c) => c.issues?.includes(id));
    convoyId = match?.id;
  } catch {
    // no convoy info
  }

  // Fetch history for timeline
  let history: BeadHistoryEntry[] = [];
  try {
    history = await getBeadHistory(id);
  } catch {
    // no history
  }

  const rigName = rigFromAssignee(bead.assignee);

  // Fetch git branch info (files changed + diffs)
  let branchInfo: BranchInfo | null = null;
  if (rigName) {
    const baseBranch = extractMeta(bead.description ?? "", "base_branch") ?? "main";
    try {
      branchInfo = await getBeadBranchInfo(rigName, id, baseBranch);
    } catch {
      // no git info
    }
  }

  // Fetch real agent terminal output
  let agentOutput = "";
  if (bead.assignee) {
    const session = sessionFromAssignee(bead.assignee);
    if (session) {
      try {
        agentOutput = await getAgentOutput(session, 40);
      } catch {
        // no session
      }
    }
  }

  return `
${renderBreadcrumbs(bead, rigName, convoyId)}

<div class="prose max-w-none mb-6">
  <h1>${escapeHtml(bead.title)}</h1>
  <div class="flex gap-2 items-center not-prose flex-wrap">
    ${statusBadge(bead.status)}
    ${priorityLabel(bead.priority)}
    <span class="badge badge-ghost font-mono text-xs">${escapeHtml(bead.id)}</span>
    <span class="badge badge-ghost text-xs">${escapeHtml(bead.issue_type)}</span>
    ${bead.assignee ? `<span class="text-sm text-base-content/50">→ ${escapeHtml(bead.assignee)}</span>` : ""}
  </div>
</div>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div class="lg:col-span-2 space-y-6">
    <div>
      <h2 class="text-lg font-bold mb-3">Description</h2>
      ${renderDescription(bead.description ?? "")}
    </div>

    ${renderDeps(bead)}

    <div>
      <h2 class="text-lg font-bold mb-3">Files Changed</h2>
      ${branchInfo ? renderFilesChanged(branchInfo) : `<p class="text-base-content/50 text-sm">No branch found for this bead</p>`}
    </div>

    ${bead.assignee ? `
    <div>
      <h2 class="text-lg font-bold mb-3">Agent Output</h2>
      ${renderAgentOutputSection(agentOutput)}
    </div>` : ""}
  </div>

  <div>
    <h2 class="text-lg font-bold mb-3">Timeline</h2>
    ${renderTimeline(history)}

    <h2 class="text-lg font-bold mt-6 mb-3">Details</h2>
    <div class="space-y-2 text-sm">
      <div><span class="text-base-content/50">Created:</span> ${escapeHtml(bead.created_at)}</div>
      <div><span class="text-base-content/50">Updated:</span> ${escapeHtml(bead.updated_at)}</div>
      ${bead.closed_at ? `<div><span class="text-base-content/50">Closed:</span> ${escapeHtml(bead.closed_at)}</div>` : ""}
      ${bead.owner ? `<div><span class="text-base-content/50">Owner:</span> ${escapeHtml(bead.owner)}</div>` : ""}
      ${bead.created_by ? `<div><span class="text-base-content/50">Created by:</span> ${escapeHtml(bead.created_by)}</div>` : ""}
      ${bead.close_reason ? `<div><span class="text-base-content/50">Close reason:</span> ${escapeHtml(bead.close_reason)}</div>` : ""}
    </div>
  </div>
</div>`;
}
