import path from "path";
import { read, rel } from "./helpers";
import { LANG_MAP } from "../constants/render-constants";

/**
 * Generate Markdown Table of Contents with anchors
 */
export function tocMd(files) {
	const count = files.length;
	const items = files.map((f, i) => `- [${rel(f)}](#${i + 1})`).join("\n");

	return [`\nIncluded Source Files (${count})`, "#### 0 ", items, "", "---"].join("\n");
}

/**
 * Render each file section with invisible anchors
 */
export function renderMd(p, i) {
	const rp = rel(p);
	const ext = path.extname(p).toLowerCase();
	const lang = LANG_MAP[ext] || "txt";
	const code = read(p).trimEnd();

	return [`---\n#### ${i + 1}`, "\n", "` File: " + rp + "`  [↑ Back to top](#0)", "", "```" + lang, code, "```", ""].join("\n");
}

/**
 * TXT version (unchanged)
 */
export function tocTxt(files) {
	const sorted = [...files].sort((a, b) => a.localeCompare(b));
	return ["##==== Combined Scope ====", ...sorted.map((f) => "## - " + rel(f))].join("\n") + "\n\n";
}

export function renderTxt(p) {
	const relPath = rel(p);
	const code = read(p);
	return ["##==== path: " + relPath + " ====", "##region " + relPath, code, "##endregion", ""].join("\n");
}
