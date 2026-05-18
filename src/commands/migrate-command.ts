import fs from "fs";
import path from "path";
import { parseJsonFile } from "../config/json";
import { migrateConfig } from "../config/migration/transform";
import { REQUIRED_CONFIG_VERSION } from "../config/migration/detect";
import type { MigrationCommandResult } from "../config/migration/types";
import { resolveRoot, validateRoot } from "../app/project-context";

export function migrateCommand(params: {
	rootArg?: string;
	cwd?: string;
	write?: boolean;
	check?: boolean;
}): MigrationCommandResult {
	const root = resolveRoot(params.rootArg, params.cwd);
	const configPath = path.join(root, "prodex.json");
	const warnings: string[] = [];
	const errors = validateRoot(root, params.rootArg);
	if (errors.length) return emptyMigrationResult(configPath, warnings, errors);

	if (!fs.existsSync(configPath)) {
		errors.push("No prodex.json found.");
		return emptyMigrationResult(configPath, warnings, errors);
	}

	let raw: any;
	try {
		raw = parseJsonFile(fs.readFileSync(configPath, "utf8"));
	} catch (err: any) {
		errors.push(`Invalid prodex.json: ${err?.message || err}`);
		return emptyMigrationResult(configPath, warnings, errors);
	}

	const preview = migrateConfig(raw);
	if (params.check && preview.needed) {
		errors.push(`prodex.json requires migration to version ${REQUIRED_CONFIG_VERSION}.`);
	}
	if (params.check) {
		return { ...preview, ok: !preview.needed, written: false, path: configPath, warnings, errors };
	}
	if (!preview.needed || !params.write) {
		return { ...preview, ok: !errors.length, written: false, path: configPath, warnings, errors };
	}

	const backupPath = nextBackupPath(root, preview.fromVersion);
	fs.copyFileSync(configPath, backupPath);
	fs.writeFileSync(configPath, `${JSON.stringify(preview.config, null, 4)}\n`, "utf8");

	return {
		...preview,
		ok: true,
		written: true,
		backupPath,
		path: configPath,
		warnings,
		errors,
	};
}

function nextBackupPath(root: string, version?: number): string {
	const suffix = version ? `v${String(version).replace(/\W+/g, "_")}` : "legacy";
	let backup = path.join(root, `prodex.${suffix}.backup.json`);
	let index = 1;
	while (fs.existsSync(backup)) {
		backup = path.join(root, `prodex.${suffix}.backup.${index}.json`);
		index++;
	}
	return backup;
}

function emptyMigrationResult(pathValue: string, warnings: string[], errors: string[]): MigrationCommandResult {
	return {
		ok: false,
		needed: false,
		toVersion: REQUIRED_CONFIG_VERSION,
		changes: [],
		written: false,
		path: pathValue,
		warnings,
		errors,
	};
}
