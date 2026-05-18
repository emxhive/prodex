import { initCommand } from "./commands/init-command";
import { migrateCommand } from "./commands/migrate-command";
import { profilesCommand } from "./commands/profiles-command";
import { runCommand } from "./commands/run-command";
import { parseCliInput } from "./cli/cli-input";
import { renderHelp, renderVersion, reportCommandResult } from "./cli/reporter";
import type { CommandResult } from "./types";

export default async function startProdex(args = process.argv): Promise<CommandResult> {
	const result = await runProdexCommand(args, process.cwd());
	reportCommandResult(result);
	process.exitCode = result.exitCode;
	return result;
}

export async function runProdexCommand(args = process.argv, cwd = process.cwd()): Promise<CommandResult> {
	const parsed = parseCliInput(args);
	const warnings = [...parsed.warnings];
	const errors = [...parsed.errors];

	if (errors.length || !parsed.command) {
		return { ok: false, exitCode: 1, warnings, errors, runs: [] };
	}

	if (parsed.command.kind === "help") {
		return { ok: true, exitCode: 0, message: renderHelp(parsed.command.topic), warnings, errors, runs: [] };
	}

	if (parsed.command.kind === "version") {
		return { ok: true, exitCode: 0, message: renderVersion(), warnings, errors, runs: [] };
	}

	if (parsed.command.kind === "init") {
		const init = initCommand(parsed.command.rootArg, cwd, parsed.command.force);
		return {
			ok: init.ok,
			exitCode: init.ok ? 0 : 1,
			message: init.message,
			warnings,
			errors: init.error ? [...errors, init.error] : errors,
			runs: [],
		};
	}

	if (parsed.command.kind === "profiles") {
		const listed = profilesCommand(parsed.command.rootArg, cwd);
		warnings.push(...listed.warnings);
		errors.push(...listed.errors);
		return {
			ok: !errors.length,
			exitCode: errors.length ? 1 : 0,
			profiles: errors.length ? undefined : listed.profiles,
			warnings,
			errors,
			runs: [],
		};
	}

	if (parsed.command.kind === "migrate") {
		const migration = migrateCommand({
			rootArg: parsed.command.rootArg,
			cwd,
			write: parsed.command.write,
			check: parsed.command.check,
		});
		return {
			ok: migration.ok,
			exitCode: migration.ok ? 0 : 1,
			migration,
			warnings: [...warnings, ...migration.warnings],
			errors: [...errors, ...migration.errors],
			runs: [],
		};
	}

	const run = await runCommand({
		rootArg: parsed.command.rootArg,
		flags: parsed.command.flags,
		cwd,
	});

	warnings.push(...run.warnings);
	errors.push(...run.errors);
	if (errors.length) return { ok: false, exitCode: 1, warnings, errors, runs: [] };

	const ok = run.runs.every((item) => item.ok);
	return {
		ok,
		exitCode: ok ? 0 : 1,
		warnings,
		errors,
		runs: run.runs,
	};
}
