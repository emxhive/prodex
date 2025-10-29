import { Logger } from "../types";

const env = () => ({
	debug: process.env.PRODEX_DEBUG === "1",
	verbose: process.env.PRODEX_VERBOSE === "1",
	silent: process.env.PRODEX_SILENT === "1",
});

export const logger: Logger = {
	debug: (...args) => !env().silent && env().debug && console.log("🪶 [debug]", ...args),
	verbose: (...args) => !env().silent && (env().verbose || env().debug) && console.log("🔎 [verbose]", ...args),
	info: (...args) => !env().silent && console.log("📌 [info]", ...args),
	warn: (...args) => !env().silent && console.warn("⚠️ [warn]", ...args),
	error: (...args) => !env().silent && console.error("💥 [error]", ...args),
	log: (...args) => !env().silent && console.log(...args),
};
