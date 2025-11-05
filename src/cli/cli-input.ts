import sade from "sade";
import path from "path";
import pkg from "../../package.json";
import fs from "fs";
import { FLAG_MAP } from "../constants/flags";
import type { ParsedInput } from "../types";

/**
 * Unified CLI parser powered by Sade and FLAG_MAP.
 * Returns { root, flags, warnings, errors }.
 */
export function parseCliInput(argv: string[] = process.argv) {
	if (argv.includes("-v") || argv.includes("--version")) {
		console.log(`prodex v${pkg.version}`);
		process.exit(0);
	}

	const program = sade("prodex [root]");
	registerFlags(program);

	let parsed: ParsedInput = { rootArg: "", root: undefined, flags: {} };

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

	parsed.flags = normalizeFlags(parsed.flags, warnings, errors);
	validateArgs(parsed, warnings, errors);

	return { ...parsed, warnings, errors };
}

function registerFlags(program: ReturnType<typeof sade>) {
	for (const [key, meta] of Object.entries(FLAG_MAP)) {
		const short = meta.short ? `-${meta.short}, ` : "";
		const long = `--${key}`;
		const desc = meta.description;
		const defaultVal = meta.type === "boolean" ? false : undefined;
		program.option(`${short}${long}`, desc, defaultVal);
	}
}

/** Convert flag values to correct types based on FLAG_MAP metadata. */
function normalizeFlags(flags: Record<string, any>, warnings: string[], errors: string[]) {
	for (const [key, meta] of Object.entries(FLAG_MAP)) {
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
				flags[key] = String(raw)
					.split(",")
					.map((v) => v.trim())
					.filter(Boolean);
				break;
			}

			default: {
				if (meta.type === "string") flags[key] = String(raw);
			}
		}
	}
	return flags;
}

/** Validate path argument and report unrecognized flags. */
function validateArgs(parsed: ParsedInput, warnings: string[], errors: string[]) {
	const { rootArg } = parsed;

	if (rootArg) {
		if (!fs.existsSync(parsed.root)) {
			errors.push(`Invalid path argument: "${rootArg}" does not exist.`);
		} else if (!fs.statSync(parsed.root).isDirectory()) {
			errors.push(`Path argument "${rootArg}" is not a directory.`);
		}
	}

	const unknown = parsed.flags?._ || [];
	if (unknown.length) {
		warnings.push(`Unrecognized arguments detected [${unknown.join(", ")}]- They were ignored.`);
	}

	if (warnings.length) console.warn("Warnings:", warnings);
	if (errors.length) {
		for (const err of errors) console.error(err);
		process.exit(1);
	}
}
