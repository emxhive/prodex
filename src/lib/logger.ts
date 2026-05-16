import type { Logger, ProdexFlags } from "../types";

let DEBUG = false;
let SILENT = false;

export function setLoggerOptions(flags: Partial<ProdexFlags> = {}): void {
	DEBUG = !!flags.debug;
	SILENT = !!(flags as any).silent;
}

export const logger: Logger = {
	debug: (...args) => {
		if (DEBUG && !SILENT) console.log("\n[debug]", ...args);
	},
	info: (...args) => {
		if (!SILENT) console.log("\n[info]", ...args);
	},
	warn: (...args) => {
		if (!SILENT) console.warn("\n[warn]", ...args);
	},
	error: (...args) => {
		if (!SILENT) console.error("\n[error]", ...args);
	},
	log: (...args) => {
		if (!SILENT) console.log("\n", ...args);
	},
	clear: () => console.clear(),
};
