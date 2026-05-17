import { buildConfig } from "../../config/normalize";
import { executeRun } from "../execute-run";
import { loadProjectContext } from "../project-context";
import type { ProdexFlags, RunPlan, RunResult } from "../../types";

export interface RunCommandResult {
	runs: RunResult[];
	warnings: string[];
	errors: string[];
}

export async function runCommand(params: {
	rootArg?: string;
	flags?: Partial<ProdexFlags>;
	cwd?: string;
}): Promise<RunCommandResult> {
	const planned = createRunPlans(params);
	const warnings = [...planned.warnings];
	const errors = [...planned.errors];

	if (errors.length) return { runs: [], warnings, errors };

	const runs: RunResult[] = [];
	for (const plan of planned.plans) {
		runs.push(await executeRun(plan));
	}

	return { runs, warnings, errors };
}

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
	const project = loadProjectContext(params.rootArg, params.cwd);
	const warnings = [...project.warnings];
	const errors = [...project.errors];
	const flags = params.flags ?? {};

	if (errors.length) return { plans: [], warnings, errors };

	const profileNames = resolveProfileNames(flags, project.config.profiles ?? {}, errors);
	if (errors.length) return { plans: [], warnings, errors };

	const plans: RunPlan[] = [];
	for (const profileName of profileNames.length ? profileNames : [undefined]) {
		const runFlags = flagsForProfileRun(flags, profileName);
		const built = buildConfig({
			root: project.root,
			userConfig: project.config,
			flags: runFlags,
			profileName,
		});

		warnings.push(...built.warnings);
		errors.push(...built.errors);
		if (!built.config) continue;

		plans.push({
			root: project.root,
			config: built.config,
			flags: runFlags,
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

function unique(values: string[]): string[] {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
