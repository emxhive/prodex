import path from "path";
import { normalizePath } from "../filesystem/path";
import type { CommandResult, RunResult } from "../types";

export function reportCommandResult(result: CommandResult): void {
	for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
	for (const error of result.errors) console.error(`Error: ${error}`);

	if (result.message) console.log(result.message);
	if (result.profiles) reportProfiles(result.profiles);
	if (result.migration) reportMigration(result.migration);

	for (const run of result.runs) reportRun(run);
}

function reportRun(run: RunResult): void {
	const label = run.profile ? ` [${run.profile}]` : "";
	for (const warning of run.warnings) console.warn(`Warning${label}: ${warning}`);
	for (const error of run.errors) console.error(`Error${label}: ${error}`);
	if (!run.outputPath) return;

	console.log(`Created${label}: ${formatPath(run.outputPath, run.root)}`);
	console.log(`Mode${label}: ${formatMode(run)}`);
	console.log(`Files${label}: ${run.files.length} total`);
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
