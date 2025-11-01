// ================================================================
// 🧩 Prodex — Render Constants
// Defines shared constants for renderer outDir formats.
// ================================================================
import pkg from "../../package.json";

export const LANG_MAP = {
	"": "js",
	".mjs": "js",
	".jsx": "jsx",
	".ts": "ts",
	".tsx": "tsx",
	".php": "php",
	".json": "json",
	".d.ts": "ts",
};

export const TEXT_HEADERS = {
	toc: "##==== Combined Scope ====",
	path: (p) => `##==== path: ${p} ====`,
	regionStart: (p) => `##region ${p}`,
	regionEnd: "##endregion",
};

export const MD_FOOTER = ["\n---", "*Generated with [Prodex](https://github.com/emxhive/prodex) — Codebase decoded.*", `<!-- PRODEx v${pkg.version} | ${new Date().toISOString()} -->`].join("\n");
