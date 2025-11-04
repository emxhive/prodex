import { getFlags } from "../store";
import { Logger } from "../types";

let FLAGS: any = null;
let DEBUG = false;
let SILENT = false;

function ensureFlags() {
	if (FLAGS) return;
	FLAGS = getFlags() || {};
	DEBUG = !!FLAGS.debug;
	SILENT = !!FLAGS.silent;
}

export const logger: Logger = {
	debug: (...a) => {
		ensureFlags();
		if (DEBUG && !SILENT) console.log("\n🪶 [debug]", ...a);
	},
	info: (...a) => {
		ensureFlags();
		if (!SILENT) console.log("\n📌 [info]", ...a);
	},
	warn: (...a) => {
		ensureFlags();
		if (!SILENT) console.warn("\n⚠️  [warn]", ...a);
	},
	error: (...a) => {
		ensureFlags();
		if (!SILENT) console.error("\n💥 [error]", ...a);
	},
	log: (...a) => {
		ensureFlags();
		if (!SILENT) console.log("\n", ...a);
	},
	clear: () => console.clear(),
};
