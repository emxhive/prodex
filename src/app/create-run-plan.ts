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

	const profileNames = resolveProfileNames(flags, loaded.config.profiles ?? {}, errors);
	if (errors.length) return { plans: [], warnings, errors };

	const names = profileNames.length ? profileNames : [undefined];
	const plans: RunPlan[] = [];

	for (const profileName of names) {
		const built = buildConfig({
			root,
			userConfig: loaded.config,
			flags: flagsForProfileRun(flags, profileName),
			profileName,
		});

		warnings.push(...built.warnings);
		errors.push(...built.errors);
		if (!built.config) continue;

		plans.push({
			root,
			config: built.config,
			flags: flagsForProfileRun(flags, profileName),
			outputName: built.config.name,
			profile: profileName,
		});
	}

	return { plans, warnings, errors };
}

function resolveProfileNames(
	flags: Partial<ProdexFlags>,
	profiles: Record<string, unknown>,
	errors: string[],
): string[] {
	if (flags.allProfiles) {
		const names = Object.keys(profiles);
		if (!names.length) errors.push("No profiles are defined in prodex.json.");
		return names;
	}
	if (Array.isArray(flags.profiles) && flags.profiles.length) return unique(flags.profiles);
	return [];
}

function flagsForProfileRun(flags: Partial<ProdexFlags>, profile?: string): Partial<ProdexFlags> {
	if (!profile) return flags;
	return {
		...flags,
		profiles: undefined,
		allProfiles: false,
	};
}

function unique<T>(values: T[]): T[] {
	return [...new Set(values.map((value) => String(value).trim()).filter(Boolean) as T[])];
}
