/* Gas Town Dashboard v2 — client-side JS */
/* DAG rendering with ELK.js for convoy dependency visualization */

(function () {
  "use strict";

  const STATUS_COLORS = {
    closed: "#22c55e",
    merged: "#22c55e",
    in_progress: "#3b82f6",
    hooked: "#3b82f6",
    active: "#3b82f6",
    open: "#eab308",
    pending: "#eab308",
    blocked: "#ef4444",
    error: "#ef4444",
    failed: "#ef4444",
  };

  const DEFAULT_COLOR = "#6b7280";

  function getStatusColor(status) {
    return STATUS_COLORS[status.toLowerCase()] || DEFAULT_COLOR;
  }

  async function renderDag() {
    const container = document.getElementById("dag-container");
    const loading = document.getElementById("dag-loading");
    const dagData = window.__dagData;
    if (!container || !dagData) return;

    const { nodes, edges } = dagData;
    if (nodes.length === 0) {
      container.innerHTML =
        '<p class="text-base-content/50 text-sm">No beads to visualize</p>';
      return;
    }

    // Load ELK.js dynamically
    let ELK;
    try {
      const mod = await import(
        "https://cdn.jsdelivr.net/npm/elkjs@0.9.3/lib/elk.bundled.js"
      );
      ELK = mod.default || mod;
    } catch {
      container.innerHTML =
        '<p class="text-error text-sm">Failed to load ELK.js layout engine</p>';
      return;
    }

    const elk = new ELK();

    const graph = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": "40",
        "elk.layered.spacing.nodeNodeBetweenLayers": "60",
      },
      children: nodes.map((n) => ({
        id: n.id,
        width: 160,
        height: 50,
        labels: [{ text: n.title }],
      })),
      edges: edges.map((e, i) => ({
        id: `e${i}`,
        sources: [e.source],
        targets: [e.target],
      })),
    };

    let layout;
    try {
      layout = await elk.layout(graph);
    } catch {
      container.innerHTML =
        '<p class="text-error text-sm">DAG layout failed</p>';
      return;
    }

    // Compute SVG viewBox
    let maxX = 0;
    let maxY = 0;
    for (const child of layout.children || []) {
      const right = (child.x || 0) + (child.width || 160);
      const bottom = (child.y || 0) + (child.height || 50);
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }
    const pad = 20;
    const vw = maxX + pad * 2;
    const vh = maxY + pad * 2;

    // Build SVG
    const svgParts = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" class="w-full" style="max-height:500px">`,
      '<defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#888"/></marker></defs>',
    ];

    // Edges
    for (const edge of layout.edges || []) {
      for (const section of edge.sections || []) {
        const pts = [section.startPoint, ...(section.bendPoints || []), section.endPoint];
        const d = pts
          .map((p, i) => `${i === 0 ? "M" : "L"} ${(p.x || 0) + pad} ${(p.y || 0) + pad}`)
          .join(" ");
        svgParts.push(
          `<path d="${d}" fill="none" stroke="#888" stroke-width="1.5" marker-end="url(#arrow)"/>`
        );
      }
    }

    // Nodes
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (const child of layout.children || []) {
      const x = (child.x || 0) + pad;
      const y = (child.y || 0) + pad;
      const w = child.width || 160;
      const h = child.height || 50;
      const node = nodeMap.get(child.id);
      const color = node ? getStatusColor(node.status) : DEFAULT_COLOR;
      const title = node
        ? truncate(node.title, 22)
        : child.id;

      svgParts.push(
        `<a href="/bead/${encodeURIComponent(child.id)}" class="dag-node">`,
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${color}20" stroke="${color}" stroke-width="2" class="cursor-pointer hover:stroke-[3]"/>`,
        `<text x="${x + w / 2}" y="${y + 18}" text-anchor="middle" fill="currentColor" font-size="11" font-weight="bold">${escapeXml(child.id)}</text>`,
        `<text x="${x + w / 2}" y="${y + 35}" text-anchor="middle" fill="currentColor" font-size="10" opacity="0.7">${escapeXml(title)}</text>`,
        `</a>`
      );
    }

    svgParts.push("</svg>");

    if (loading) loading.remove();
    container.innerHTML = svgParts.join("\n");
  }

  function truncate(s, max) {
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  }

  function escapeXml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Run DAG rendering when page loads
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderDag);
  } else {
    renderDag();
  }
})();

/* ── Guided Tour Overlay ── */
(function () {
  "use strict";

  const STORAGE_KEY = "gastown-tour-complete";

  const STEPS = [
    { selector: ".drawer-side .menu-sm", title: "Navigation", desc: "The sidebar lets you jump between Pipeline, Agents, Mayor, and Tour views." },
    { selector: ".drawer-side .divider", title: "Rigs", desc: "Your project rigs appear below the divider. Each rig wraps a git repo and its agents." },
    { selector: 'a[href="/mayor"]', title: "Mayor", desc: "The Mayor is your AI coordinator — it creates convoys, spawns agents, and tracks progress." },
    { selector: 'a[href="/"]', title: "Pipeline", desc: "The Pipeline view shows all beads flowing through your workspace, organized by stage." },
    { selector: 'a[href="/agents"]', title: "Agents", desc: "Monitor your polecats here — see who's working, idle, or stuck." },
    { selector: 'a[href="/tour"]', title: "Merge Queue & More", desc: "The Refinery merge queue processes completed work automatically. Use the Tour page anytime to revisit these concepts." },
  ];

  let current = 0;
  let overlay = null;
  let highlight = null;

  function createOverlay() {
    overlay = document.createElement("div");
    overlay.id = "tour-overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.5);";

    highlight = document.createElement("div");
    highlight.id = "tour-highlight";
    highlight.style.cssText = "position:absolute;z-index:9999;border:2px solid hsl(var(--p));border-radius:8px;box-shadow:0 0 0 4px hsl(var(--p)/0.3);pointer-events:none;transition:all 0.3s ease;";

    const card = document.createElement("div");
    card.id = "tour-card";
    card.className = "card bg-base-100 shadow-xl";
    card.style.cssText = "position:fixed;z-index:10000;width:340px;max-width:90vw;";
    card.innerHTML = `
      <div class="card-body p-4">
        <div class="flex justify-between items-center mb-1">
          <span id="tour-step-label" class="badge badge-primary badge-sm"></span>
          <button id="tour-skip" class="btn btn-ghost btn-xs">Skip</button>
        </div>
        <h3 id="tour-title" class="font-bold text-lg"></h3>
        <p id="tour-desc" class="text-sm text-base-content/70"></p>
        <div class="card-actions justify-between mt-2">
          <button id="tour-back" class="btn btn-ghost btn-sm">← Back</button>
          <button id="tour-next" class="btn btn-primary btn-sm">Next →</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    document.body.appendChild(highlight);
    document.body.appendChild(card);

    document.getElementById("tour-skip").addEventListener("click", endTour);
    document.getElementById("tour-back").addEventListener("click", function () {
      if (current > 0) { current--; showStep(); }
    });
    document.getElementById("tour-next").addEventListener("click", function () {
      if (current < STEPS.length - 1) { current++; showStep(); }
      else { endTour(); }
    });
    overlay.addEventListener("click", endTour);
  }

  function showStep() {
    const step = STEPS[current];
    const el = document.querySelector(step.selector);
    const card = document.getElementById("tour-card");

    document.getElementById("tour-step-label").textContent = (current + 1) + " / " + STEPS.length;
    document.getElementById("tour-title").textContent = step.title;
    document.getElementById("tour-desc").textContent = step.desc;
    document.getElementById("tour-back").style.visibility = current === 0 ? "hidden" : "visible";
    document.getElementById("tour-next").textContent = current === STEPS.length - 1 ? "Finish ✓" : "Next →";

    if (el) {
      const r = el.getBoundingClientRect();
      highlight.style.display = "block";
      highlight.style.left = (r.left - 4) + "px";
      highlight.style.top = (r.top - 4) + "px";
      highlight.style.width = (r.width + 8) + "px";
      highlight.style.height = (r.height + 8) + "px";
      // Position card below or above the element
      const below = r.bottom + 12;
      const above = r.top - 12 - 200;
      card.style.top = (below + 200 < window.innerHeight ? below : Math.max(8, above)) + "px";
      card.style.left = Math.min(r.left, window.innerWidth - 360) + "px";
    } else {
      highlight.style.display = "none";
      card.style.top = "50%";
      card.style.left = "50%";
      card.style.transform = "translate(-50%,-50%)";
    }
  }

  function startTour() {
    current = 0;
    if (!overlay) createOverlay();
    overlay.style.display = "block";
    highlight.style.display = "block";
    document.getElementById("tour-card").style.display = "block";
    showStep();
  }

  function endTour() {
    localStorage.setItem(STORAGE_KEY, "true");
    if (overlay) overlay.style.display = "none";
    if (highlight) highlight.style.display = "none";
    var card = document.getElementById("tour-card");
    if (card) card.style.display = "none";
  }

  // Expose for the tour page button
  window.__startTour = startTour;

  // Auto-show on first visit
  function autoShow() {
    if (!localStorage.getItem(STORAGE_KEY)) {
      startTour();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoShow);
  } else {
    autoShow();
  }
})();
