import fs from "fs";
import path from "path";
import { loadConfig } from "../config/load";
import { buildConfig } from "../config/normalize";
import type { ProdexFlags, RunPlan } from "../types";

export interface CreateRunPlansResult {
	plans: RunPlan[];
	warnings: string[];
	errors: string[];
}

export function createRunPlans(params: {
	rootArg?: string;
	flags?: Partial<ProdexFlags>;
	cwd?: string;
}): CreateRunPlansResult {
	const warnings: string[] = [];
	const errors: string[] = [];
	const cwd = params.cwd ?? process.cwd();
	const root = params.rootArg ? path.resolve(cwd, params.rootArg) : cwd;
	const flags = params.flags ?? {};

	if (!fs.existsSync(root)) errors.push(`Invalid root path "${params.rootArg}".`);
	else if (!fs.statSync(root).isDirectory()) errors.push(`Root path "${params.rootArg}" is not a directory.`);
	if (errors.length) return { plans: [], warnings, errors };

	const loaded = loadConfig(root);
	warnings.push(...loaded.warnings);
	errors.push(...loaded.errors);
	if (errors.length) return { plans: [], warnings, errors };

	const shortcutNames = resolveShortcutNames(flags, loaded.config.shortcuts ?? {}, errors);
	if (errors.length) return { plans: [], warnings, errors };

	const names = shortcutNames.length ? shortcutNames : [undefined];
	const plans: RunPlan[] = [];

	for (const shortcutName of names) {
		const built = buildConfig({
			root,
			userConfig: loaded.config,
			flags: flagsForShortcutRun(flags, shortcutName),
			shortcutName,
		});

		warnings.push(...built.warnings);
		errors.push(...built.errors);
		if (!built.config) continue;

		plans.push({
			root,
			config: built.config,
			flags: flagsForShortcutRun(flags, shortcutName),
			outputName: built.config.name,
			shortcut: shortcutName,
		});
	}

	return { plans, warnings, errors };
}

function resolveShortcutNames(
	flags: Partial<ProdexFlags>,
	shortcuts: Record<string, unknown>,
	errors: string[],
): string[] {
	if (flags.shortcutAll) {
		const names = Object.keys(shortcuts);
		if (!names.length) errors.push("No shortcuts are defined in prodex.json.");
		return names;
	}
	if (Array.isArray(flags.shortcuts) && flags.shortcuts.length) return unique(flags.shortcuts);
	if (flags.shortcut) return [flags.shortcut];
	return [];
}

function flagsForShortcutRun(flags: Partial<ProdexFlags>, shortcut?: string): Partial<ProdexFlags> {
	if (!shortcut) return flags;
	return {
		...flags,
		shortcut,
		shortcuts: undefined,
		shortcutAll: false,
	};
}

function unique<T>(values: T[]): T[] {
	return [...new Set(values.map((value) => String(value).trim()).filter(Boolean) as T[])];
}
