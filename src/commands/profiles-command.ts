import { loadProjectContext } from "../app/project-context";

export interface ProfilesCommandResult {
	profiles: string[];
	warnings: string[];
	errors: string[];
}

export function profilesCommand(rootArg?: string, cwd = process.cwd()): ProfilesCommandResult {
	const project = loadProjectContext(rootArg, cwd);
	const warnings = [...project.warnings];
	const errors = [...project.errors];

	if (errors.length) return { profiles: [], warnings, errors };

	return {
		profiles: Object.keys(project.config.profiles ?? {}).sort(),
		warnings,
		errors,
	};
}
