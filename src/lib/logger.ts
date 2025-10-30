import { Logger } from "../types";

const env = () => {
	const obj = { debug: process.env.PRODEX_DEBUG === "1", silent: process.env.PRODEX_SILENT === "1" };
	return obj;
};

export const logger: Logger = {
	debug: (...args) => !env().silent && env().debug && console.log("\n🪶 [debug]", ...args),
	info: (...args) => !env().silent && console.log("\n📌 [info]", ...args),
	warn: (...args) => !env().silent && console.warn("\n⚠️ [warn]", ...args),
	error: (...args) => !env().silent && console.error("\n💥 [error]", ...args),
	log: (...args) => !env().silent && console.log("\n",...args),
};
