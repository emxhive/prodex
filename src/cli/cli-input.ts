import sade, { Value } from "sade";
import { FlagKey, PRODEX_FLAGS } from "./flags";
import { logger } from "../lib/logger";
import path from "path";
import pkg from "../../package.json";
import { ProdexFlags } from "../types";

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

	// Register flags dynamically
	for (const [key, meta] of Object.entries(PRODEX_FLAGS)) {
		const short = meta.short ? `-${meta.short}, ` : "";
		const long = `--${key}`;
		const desc = meta.description;

		let defaultVal: Value | undefined;
		switch (meta.type) {
			case "boolean":
				defaultVal = false;
				break;
			default:
				defaultVal = undefined; // defer strings/numbers/lists
		}

		if (defaultVal !== undefined) {
			program.option(`${short}${long}`, desc, defaultVal);
		} else {
			program.option(`${short}${long}`, desc);
		}
	}

	let parsed: { root?: string; flags: Partial<ProdexFlags> } = { root: undefined, flags: {} };

	// Define default command (root optional)
	program.action((root: string | undefined, opts: Record<string, any>) => {
		const cwd = process.cwd();
		parsed = {
			root: root ? path.resolve(cwd, root) : cwd,
			flags: { ...opts },
		};
	});

	program.parse(argv);

	const warnings: string[] = [];
	const errors: string[] = [];

	// Post-parse casting + normalization
	for (const [key, meta] of Object.entries(PRODEX_FLAGS)) {
   
		const raw = parsed.flags[key];
		if (raw === undefined) continue;
const obj = {};
		switch (meta.type) {
			case "number": {
				const num = Number(raw);
				if (Number.isNaN(num)) {
					errors.push(`Flag --${key} expected a number but got "${raw}"`);
				} else {
					parsed.flags[key] = num;
				}
				break;
			}

			case "list": {
				const arr = String(raw)
					.split(",")
					.map((v) => v.trim())
					.filter(Boolean);
				parsed.flags[key] = arr;
				break;
			}
		}
	}


	return {
		...parsed,
		warnings,
		errors,
	};
}
