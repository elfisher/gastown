import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Rig } from "../data/schemas.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templateDir = resolve(__dirname, "../../templates");

function loadTemplate(name: string): string {
  return readFileSync(resolve(templateDir, name), "utf-8");
}

export function renderLayout(
  title: string,
  content: string,
  rigs: Rig[],
  activePath: string,
): string {
  const template = loadTemplate("layout.html");
  const navItems = rigs
    .map((r) => {
      const href = `/rig/${r.name}`;
      const active = activePath === href ? "active" : "";
      const statusDot = r.status === "operational" ? "🟢" : "🔴";
      return `<li><a href="${href}" class="${active}">${statusDot} ${r.name}</a></li>`;
    })
    .join("\n            ");

  return template
    .replace("{{title}}", title)
    .replace("{{navItems}}", navItems)
    .replace("{{content}}", content);
}
