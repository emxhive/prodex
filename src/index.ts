import path from "path";
import { createRunPlans } from "./app/create-run-plan";
import { executeRun } from "./app/execute-run";
import { listShortcuts } from "./app/list-shortcuts";
import { parseCliInput } from "./cli/cli-input";
import { initProdex } from "./cli/init";
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
		return { ok: true, exitCode: 0, message: renderHelp(), warnings, errors, runs: [] };
	}

	if (parsed.command.kind === "version") {
		return { ok: true, exitCode: 0, message: renderVersion(), warnings, errors, runs: [] };
	}

	if (parsed.command.kind === "init") {
		const root = parsed.command.rootArg ? path.resolve(cwd, parsed.command.rootArg) : cwd;
		const init = initProdex(root, { force: parsed.command.force });
		return {
			ok: init.ok,
			exitCode: init.ok ? 0 : 1,
			message: init.message,
			warnings,
			errors: init.error ? [...errors, init.error] : errors,
			runs: [],
		};
	}

	if (parsed.command.kind === "shortcuts") {
		const listed = listShortcuts(parsed.command.rootArg, cwd);
		warnings.push(...listed.warnings);
		errors.push(...listed.errors);
		return {
			ok: !errors.length,
			exitCode: errors.length ? 1 : 0,
			shortcuts: errors.length ? undefined : listed.shortcuts,
			warnings,
			errors,
			runs: [],
		};
	}

	const planned = createRunPlans({
		rootArg: parsed.command.rootArg,
		flags: parsed.command.flags,
		cwd,
	});

	warnings.push(...planned.warnings);
	errors.push(...planned.errors);

	if (errors.length) {
		return { ok: false, exitCode: 1, warnings, errors, runs: [] };
	}

	const runs = [];
	for (const plan of planned.plans) {
		runs.push(await executeRun(plan));
	}

	const ok = runs.every((run) => run.ok);
	return {
		ok,
		exitCode: ok ? 0 : 1,
		warnings,
		errors,
		runs,
	};
}
