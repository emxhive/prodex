import path from "path";
import pkg from "../../package.json";
import type { CommandResult, RunResult } from "../types";
import { normalizePath } from "../platform/path";

export function renderHelp(): string {
	return [
		"Usage:",
		"  prodex [root] [options]",
		"  prodex run [root] [options]",
		"  prodex init [root]",
		"  prodex shortcuts [root]",
		"",
		"Options:",
		"  -f, --files <globs>       Entry files to trace, comma-separated.",
		"  -i, --include <globs>     Extra files to append, comma-separated.",
		"  -x, --exclude <globs>     Files or folders to skip, comma-separated.",
		"  -n, --name <name>         Output name prefix.",
		"  -t, --txt                 Write text output instead of Markdown.",
		"  -l, --limit <number>      Traversal file limit.",
		"  -c, --ci                  Headless mode.",
		"  -d, --debug               Enable debug logs.",
		"  -a, --shortcut <name>     Run a named shortcut.",
		"  --shortcuts               List configured shortcut keys.",
		"  -h, --help                Show help.",
		"  -v, --version             Show version.",
		"",
		"Shortcuts:",
		"  prodex @api @dashboard    Run shortcuts in the order provided.",
		"  prodex @                  Run all configured shortcuts.",
	].join("\n");
}

export function renderVersion(): string {
	return `prodex v${pkg.version}`;
}

export function reportCommandResult(result: CommandResult): void {
	for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
	for (const error of result.errors) console.error(`Error: ${error}`);

	if (result.message) console.log(result.message);
	if (result.shortcuts) reportShortcuts(result.shortcuts);

	for (const run of result.runs) {
		const label = run.shortcut ? ` [${run.shortcut}]` : "";
		for (const warning of run.warnings) console.warn(`Warning${label}: ${warning}`);
		for (const error of run.errors) console.error(`Error${label}: ${error}`);
		if (run.outputPath) {
			console.log(`Created${label}: ${formatPath(run.outputPath, run.root)}`);
			console.log(`Mode${label}: ${formatMode(run)}`);
			console.log(`Files${label}: ${run.files.length} total`);
		}
	}
}

function reportShortcuts(shortcuts: string[]): void {
	if (!shortcuts.length) {
		console.log("No shortcuts configured.");
		return;
	}

	console.log("Available shortcuts:");
	for (const shortcut of shortcuts) console.log(`  ${shortcut}`);
}

function formatPath(filePath: string, root: string): string {
	const absolute = path.resolve(filePath);
	const relative = path.relative(root, absolute);
	if (!relative.startsWith("..") && !path.isAbsolute(relative)) return normalizePath(relative);
	return normalizePath(absolute);
}

function formatMode(run: RunResult): string {
	if (run.mode === "include-only") return `include-only (${run.includes.length} include patterns)`;
	if (run.mode === "mixed") return `trace + includes (${run.entries.length} entries, ${run.includes.length} include patterns)`;
	return `trace (${run.entries.length} entries)`;
}
