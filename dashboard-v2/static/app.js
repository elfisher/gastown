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
