import path from "path";
import { read, rel } from "./helpers";
import { LANG_MAP } from "../constants/render-constants";

/**
 * Generate Markdown Table of Contents
 * Sorted alphabetically for deterministic structure.
 */
export function tocMd(files) {
  const sorted = [...files].sort((a, b) => a.localeCompare(b));
  const items = sorted.map(f => "- " + rel(f)).join("\n");
  return `# Included Source Files(${sorted.length})\n\n${items}\n\n---\n`;
}

/**
 * Render a single file section in Markdown format.
 * The first file skips the leading separator to avoid duplicates.
 */
export function renderMd(p) {
  const rp = rel(p);
  const ext = path.extname(p).toLowerCase();
  const lang = LANG_MAP[ext] || "txt";
  const code = read(p).trimEnd();

  return [
    `\`File: ${rp}\``,
    "",
    "```" + lang,
    code,
    "```",
    ""
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * TXT version (unchanged)
 */
export function tocTxt(files) {
  const sorted = [...files].sort((a, b) => a.localeCompare(b));
  return (
    ["##==== Combined Scope ====", ...sorted.map(f => "## - " + rel(f))].join("\n") + "\n\n"
  );
}

export function renderTxt(p) {
  const relPath = rel(p);
  const code = read(p);
  return [
    "##==== path: " + relPath + " ====",
    "##region " + relPath,
    code,
    "##endregion",
    ""
  ].join("\n");
}
