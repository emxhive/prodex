import { initCommand } from "./commands/init-command";
import { migrateCommand } from "./commands/migrate-command";
import { packCommand } from "./commands/pack-command";
import { traceCommand } from "./commands/trace-command";
import { scopeCommand } from "./commands/scope-command";
import { gitCommand } from "./commands/git-command";
import { grepCommand } from "./commands/grep-command";
import { parseCliInput } from "./cli/cli-input";
import { renderHelp, renderVersion, reportCommandResult } from "./cli/reporter";
import type { CommandResult } from "./types";
import type { PlannerCommandResult } from "./commands/shared-runner";
import { ProgressReporter, ConsoleProgressReporter, NoopProgressReporter } from "./app/progress";

export default async function startProdex(args = process.argv): Promise<CommandResult> {
	const parsed = parseCliInput(args);
	const isSilent = parsed.command && parsed.command.kind !== "help" && parsed.command.kind !== "version" && (parsed.command as any).flags?.silent;
	const progress = isSilent ? new NoopProgressReporter() : new ConsoleProgressReporter();

	let result: CommandResult | undefined;
	try {
		result = await runProdexCommand(args, process.cwd(), progress);
		return result;
	} finally {
		progress.finish();
		if (result) {
			reportCommandResult(result);
			process.exitCode = result.exitCode;
		}
	}
}

export async function runProdexCommand(
	args = process.argv,
	cwd = process.cwd(),
	progress?: ProgressReporter
): Promise<CommandResult> {
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

	const kind = parsed.command.kind;
	if (kind === "pack" || kind === "trace" || kind === "scope" || kind === "git" || kind === "grep") {
		let cmdRes: PlannerCommandResult;
		const params = { rootArg: parsed.command.rootArg, flags: parsed.command.flags, cwd, progress };

		if (kind === "pack") {
			cmdRes = await packCommand(params);
		} else if (kind === "trace") {
			cmdRes = await traceCommand(params);
		} else if (kind === "scope") {
			cmdRes = await scopeCommand(params);
		} else if (kind === "git") {
			cmdRes = await gitCommand(params);
		} else {
			cmdRes = await grepCommand(params);
		}

		warnings.push(...cmdRes.warnings);
		errors.push(...cmdRes.errors);
		if (errors.length) return { ok: false, exitCode: 1, warnings, errors, runs: [] };

		if (kind === "scope" && cmdRes.scopes) {
			return {
				ok: true,
				exitCode: 0,
				scopes: cmdRes.scopes,
				warnings,
				errors,
				runs: [],
			};
		}

		const ok = cmdRes.runs.every((item) => item.ok);
		return {
			ok,
			exitCode: ok ? 0 : 1,
			warnings,
			errors,
			runs: cmdRes.runs,
		};
	}

	return {
		ok: false,
		exitCode: 1,
		warnings,
		errors: [...errors, "Unknown command kind"],
		runs: [],
	};
}
