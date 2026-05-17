import path from "path";
import pkg from "../../package.json";
import type { CommandResult, RunResult } from "../types";
import { normalizePath } from "../platform/path";

export function renderHelp(topic?: string): string {
	if (topic === "run") return renderRunHelp();
	if (topic === "init") return renderInitHelp();
	if (topic === "profiles") return renderProfilesHelp();
	if (topic === "migrate") return renderMigrateHelp();

	return [
		"Usage:",
		"  prodex run [root] [options]",
		"  prodex init [root]",
		"  prodex profiles [root]",
		"  prodex migrate [root] [--write|--check]",
		"",
		"Global options:",
		"  -h, --help                Show help.",
		"  -v, --version             Show version.",
		"",
		"Run `prodex <command> --help` for command-specific help.",
	].join("\n");
}

function renderRunHelp(): string {
	return [
		"Usage:",
		"  prodex run [root] [options]",
		"",
		"Options:",
		"  -e, --entry <glob>        Entry file/glob. Repeatable and comma-aware.",
		"  -i, --include <glob>      Extra file/glob to append. Repeatable and comma-aware.",
		"  -x, --exclude <glob>      File/glob to skip. Repeatable and comma-aware.",
		"  -p, --profile <name>      Run a named profile. Repeatable.",
		"  --all-profiles            Run every configured profile.",
		"  -n, --name <name>         Output basename for this run.",
		"  -F, --format <md|txt>     Output format.",
		"  --max-depth <number>      Maximum dependency traversal depth.",
		"  --max-files <number>      Maximum traced file count.",
		"  -d, --debug               Enable debug logs.",
		"  -h, --help                Show run help.",
	].join("\n");
}

function renderInitHelp(): string {
	return [
		"Usage:",
		"  prodex init [root]",
		"",
		"Create a prodex.json file in the target root.",
	].join("\n");
}

function renderProfilesHelp(): string {
	return [
		"Usage:",
		"  prodex profiles [root]",
		"",
		"List configured profile keys without running Prodex.",
	].join("\n");
}

function renderMigrateHelp(): string {
	return [
		"Usage:",
		"  prodex migrate [root]",
		"  prodex migrate [root] --write",
		"  prodex migrate [root] --check",
		"",
		"Preview, check, or write a prodex.json migration to config version 4.",
		"",
		"Options:",
		"  --write                  Back up and update prodex.json.",
		"  --check                  Exit nonzero if migration is required.",
	].join("\n");
}

export function renderVersion(): string {
	return `prodex v${pkg.version}`;
}

export function reportCommandResult(result: CommandResult): void {
	for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
	for (const error of result.errors) console.error(`Error: ${error}`);

	if (result.message) console.log(result.message);
	if (result.profiles) reportProfiles(result.profiles);
	if (result.migration) reportMigration(result.migration);

	for (const run of result.runs) {
		const label = run.profile ? ` [${run.profile}]` : "";
		for (const warning of run.warnings) console.warn(`Warning${label}: ${warning}`);
		for (const error of run.errors) console.error(`Error${label}: ${error}`);
		if (run.outputPath) {
			console.log(`Created${label}: ${formatPath(run.outputPath, run.root)}`);
			console.log(`Mode${label}: ${formatMode(run)}`);
			console.log(`Files${label}: ${run.files.length} total`);
		}
	}
}

function reportMigration(migration: NonNullable<CommandResult["migration"]>): void {
	if (migration.errors.length) return;

	if (!migration.needed) {
		console.log("prodex.json is already using config version 4.");
		return;
	}

	if (migration.written) {
		console.log(`Backed up prodex.json to ${formatPath(migration.backupPath!, path.dirname(migration.path))}`);
		console.log("Migrated prodex.json to version 4.");
		return;
	}

	const from = migration.fromVersion ?? "legacy";
	console.log(`prodex.json can be migrated from version ${from} to version 4.`);
	if (migration.changes.length) {
		console.log("");
		console.log("Changes:");
		for (const change of migration.changes) console.log(`  ${change}`);
	}
	console.log("");
	console.log("Run `prodex migrate --write` to update prodex.json.");
}

function reportProfiles(profiles: string[]): void {
	if (!profiles.length) {
		console.log("No profiles configured.");
		return;
	}

	console.log("Available profiles:");
	for (const profile of profiles) console.log(`  ${profile}`);
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
