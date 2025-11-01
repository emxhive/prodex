import sade, { Value } from "sade";
import { FlagKey, PRODEX_FLAGS } from "./flags";
import { logger } from "../lib/logger";
import path from "path";
import pkg from "../../package.json";
import { ParsedInput, ProdexFlags } from "../types";
import fs from "fs";

/**
 * Unified CLI parser powered by Sade.
 * Returns { root, entries (from --files), flags, warnings, errors }.
 */

export function parseCliInput(argv: string[] = process.argv) {
	if (argv.includes("-v") || argv.includes("--version")) {
		logger.log(`prodex v${pkg.version}`);
		process.exit(0);
	}
	const program = sade("prodex [root]");

	registerFlags(program);

	let parsed: ParsedInput = { rootArg: "", root: undefined, flags: {} };

	// Define action
	program.action((root: string | undefined, opts: Record<string, any>) => {
		const cwd = process.cwd();

		parsed = {
			rootArg: root,
			root: root ? path.resolve(cwd, root) : cwd,
			flags: { ...opts },
		};
	});

	program.parse(argv);

	const warnings: string[] = [];
	const errors: string[] = [];

	// Post-parse casting + normalization
	parsed.flags = normalizeFlags(parsed.flags, warnings, errors);

	validateArgs(parsed, warnings, errors);

	return {
		...parsed,
		warnings,
		errors,
	};
}

function registerFlags(program: ReturnType<typeof sade>) {
	for (const [key, meta] of Object.entries(PRODEX_FLAGS)) {
		const short = meta.short ? `-${meta.short}, ` : "";
		const long = `--${key}`;
		const desc = meta.description;

		let defaultVal: Value | undefined;
		if (meta.type === "boolean") defaultVal = false;

		if (defaultVal !== undefined) program.option(`${short}${long}`, desc, defaultVal);
		else program.option(`${short}${long}`, desc);
	}
}

function normalizeFlags(flags: Record<string, any>, warnings: string[], errors: string[]) {
	for (const [key, meta] of Object.entries(PRODEX_FLAGS)) {
		const raw = flags[key];
		if (raw === undefined) continue;

		switch (meta.type) {
			case "number": {
				const num = Number(raw);
				if (Number.isNaN(num)) errors.push(`Flag --${key} expected a number but got "${raw}"`);
				else flags[key] = num;
				break;
			}

			case "list": {
				const arr = String(raw)
					.split(",")
					.map((v) => v.trim())
					.filter(Boolean);
				flags[key] = arr;
				break;
			}
		}
	}

	return flags;
}

function validateArgs(parsed: ParsedInput, warnings: string[], errors: string[]) {
	const {
		rootArg,
		flags: { _: unknown },
	} = parsed;

	if (rootArg) {
		if (!fs.existsSync(parsed.root)) {
			errors.push(`Invalid path argument: "${rootArg}" does not exist.`);
		} else if (!fs.statSync(parsed.root).isDirectory()) {
			errors.push(`Path argument "${rootArg}" is not a directory.`);
		}
	}

	if (unknown.length) {
		warnings.push(`Unrecognized arguments detected [${unknown.join(", ")}]- They were ignored.`);
	}

	if (warnings.length) logger.warn("Warnings:", warnings);
	if (errors.length) {
		for (const err of errors) logger.error(err);
		process.exit(1);
	}
}
