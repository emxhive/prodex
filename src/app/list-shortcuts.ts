import fs from "fs";
import path from "path";
import { loadConfig } from "../config/load";

export interface ListShortcutsResult {
	shortcuts: string[];
	warnings: string[];
	errors: string[];
}

export function listShortcuts(rootArg?: string, cwd = process.cwd()): ListShortcutsResult {
	const warnings: string[] = [];
	const errors: string[] = [];
	const root = rootArg ? path.resolve(cwd, rootArg) : cwd;

	if (!fs.existsSync(root)) errors.push(`Invalid root path "${rootArg}".`);
	else if (!fs.statSync(root).isDirectory()) errors.push(`Root path "${rootArg}" is not a directory.`);
	if (errors.length) return { shortcuts: [], warnings, errors };

	const loaded = loadConfig(root);
	warnings.push(...loaded.warnings);
	errors.push(...loaded.errors);
	if (errors.length) return { shortcuts: [], warnings, errors };

	return {
		shortcuts: Object.keys(loaded.config.shortcuts ?? {}).sort(),
		warnings,
		errors,
	};
}
