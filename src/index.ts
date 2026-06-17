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

	if (parsed.command.kind === "pack") {
		const pack = await packCommand({
			rootArg: parsed.command.rootArg,
			flags: parsed.command.flags,
			cwd,
		});
		warnings.push(...pack.warnings);
		errors.push(...pack.errors);
		if (errors.length) return { ok: false, exitCode: 1, warnings, errors, runs: [] };
		const ok = pack.runs.every((item) => item.ok);
		return {
			ok,
			exitCode: ok ? 0 : 1,
			warnings,
			errors,
			runs: pack.runs,
		};
	}

	if (parsed.command.kind === "trace") {
		const trace = await traceCommand({
			rootArg: parsed.command.rootArg,
			flags: parsed.command.flags,
			cwd,
		});
		warnings.push(...trace.warnings);
		errors.push(...trace.errors);
		if (errors.length) return { ok: false, exitCode: 1, warnings, errors, runs: [] };
		const ok = trace.runs.every((item) => item.ok);
		return {
			ok,
			exitCode: ok ? 0 : 1,
			warnings,
			errors,
			runs: trace.runs,
		};
	}

	if (parsed.command.kind === "scope") {
		const scope = await scopeCommand({
			rootArg: parsed.command.rootArg,
			flags: parsed.command.flags,
			cwd,
		});
		warnings.push(...scope.warnings);
		errors.push(...scope.errors);
		if (errors.length) return { ok: false, exitCode: 1, warnings, errors, runs: [] };
		if (scope.scopes) {
			return {
				ok: true,
				exitCode: 0,
				scopes: scope.scopes,
				warnings,
				errors,
				runs: [],
			};
		}
		const ok = scope.runs.every((item) => item.ok);
		return {
			ok,
			exitCode: ok ? 0 : 1,
			warnings,
			errors,
			runs: scope.runs,
		};
	}

	if (parsed.command.kind === "git") {
		const gitRes = await gitCommand({
			rootArg: parsed.command.rootArg,
			flags: parsed.command.flags,
			cwd,
		});
		warnings.push(...gitRes.warnings);
		errors.push(...gitRes.errors);
		if (errors.length) return { ok: false, exitCode: 1, warnings, errors, runs: [] };
		const ok = gitRes.runs.every((item) => item.ok);
		return {
			ok,
			exitCode: ok ? 0 : 1,
			warnings,
			errors,
			runs: gitRes.runs,
		};
	}

	if (parsed.command.kind === "grep") {
		const grepRes = await grepCommand({
			rootArg: parsed.command.rootArg,
			flags: parsed.command.flags,
			cwd,
		});
		warnings.push(...grepRes.warnings);
		errors.push(...grepRes.errors);
		if (errors.length) return { ok: false, exitCode: 1, warnings, errors, runs: [] };
		const ok = grepRes.runs.every((item) => item.ok);
		return {
			ok,
			exitCode: ok ? 0 : 1,
			warnings,
			errors,
			runs: grepRes.runs,
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
