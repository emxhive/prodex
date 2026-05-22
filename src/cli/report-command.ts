import path from "path";
import { normalizePath } from "../filesystem/path";
import type { CommandResult, RunResult } from "../types";

export function reportCommandResult(result: CommandResult): void {
	for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
	for (const error of result.errors) console.error(`Error: ${error}`);

	if (result.message) console.log(result.message);
	if (result.profiles) reportProfiles(result.profiles);
	if (result.migration) reportMigration(result.migration);

	reportRuns(result.runs);
}

function reportRuns(runs: RunResult[]): void {
	for (const run of runs) {
		reportRunWarningsAndErrors(run);
	}

	const successfulRuns = runs.filter((run) => run.outputPath);
	if (!successfulRuns.length) return;

	const rows = successfulRuns.map((run) => ({
		label: formatRunLabel(run),
		mode: run.mode,
		files: String(run.files.length),
		output: formatPath(run.outputPath!, run.root),
	}));
	const labelWidth = maxWidth(rows.map((row) => row.label));
	const modeWidth = maxWidth(rows.map((row) => row.mode));
	const filesWidth = maxWidth(rows.map((row) => row.files));

	for (const row of rows) {
		console.log(`✓ ${row.label.padEnd(labelWidth)}  ${row.mode.padEnd(modeWidth)}  ${row.files.padStart(filesWidth)}  ${row.output}`);
	}
}

function reportRunWarningsAndErrors(run: RunResult): void {
	const label = run.profile ? ` [${run.profile}]` : "";
	for (const warning of run.warnings) console.warn(`Warning${label}: ${warning}`);
	for (const error of run.errors) console.error(`Error${label}: ${error}`);
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

function formatRunLabel(run: RunResult): string {
	if (run.profile) return run.profile;
	if (run.outputName) return run.outputName;
	if (!run.outputPath) return "run";

	const ext = path.extname(run.outputPath);
	const base = path.basename(run.outputPath, ext);
	return base.replace(/-trace(?:_\d{6}-\d{4})?$/, "") || "run";
}

function formatPath(filePath: string, root: string): string {
	const absolute = path.resolve(filePath);
	const relative = path.relative(root, absolute);
	if (!relative.startsWith("..") && !path.isAbsolute(relative)) return normalizePath(relative);
	return normalizePath(absolute);
}

function maxWidth(values: string[]): number {
	return values.reduce((max, value) => Math.max(max, value.length), 0);
}
