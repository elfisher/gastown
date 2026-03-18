/**
 * linkify — turns entity IDs in pre-escaped HTML text into clickable links.
 *
 * Patterns:
 *   hq-cv-XXXXX        → /convoy/hq-cv-XXXXX
 *   PREFIX-XXXXX        → /bead/PREFIX-XXXXX     (simple bead)
 *   PREFIX-WORD-XXXXX   → /bead/PREFIX-WORD-XXXXX (compound bead like gt-wisp-fji5)
 *
 * Input MUST already be HTML-escaped. Output contains <a> tags.
 */

// Known non-bead prefixes to skip (CSS classes, common words)
const SKIP_PREFIXES = new Set([
  "badge", "base", "chat", "card", "stat", "text", "flex",
  "grid", "font", "link", "menu", "btn", "col", "max", "min",
  "pre", "hx", "lg", "md", "sm", "xl",
]);

// Single combined regex that matches convoy IDs and bead IDs.
// Convoy: hq-cv-XXX  |  Compound bead: xx-word-xxx  |  Simple bead: xx-xxx
const ENTITY_RE = /\b(hq-cv-[a-z0-9]{3,7})\b|\b([a-z]{1,4})-([a-z]+-[a-z0-9]{2,7}|[a-z0-9]{2,7})\b/g;

export function linkify(text: string): string {
  return text.replace(ENTITY_RE, (match, convoy?: string, prefix?: string) => {
    if (convoy) {
      return `<a href="/convoy/${encodeURIComponent(convoy)}" class="link link-hover font-mono">${convoy}</a>`;
    }
    if (prefix && SKIP_PREFIXES.has(prefix)) {
      return match;
    }
    return `<a href="/bead/${encodeURIComponent(match)}" class="link link-hover font-mono">${match}</a>`;
  });
}
