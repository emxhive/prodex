import { logger } from "../lib/logger";
import { rel } from "../core/helpers";
import { getConfig, getFlags } from "../store";

let CONFIG;
let FLAGS;
export function endSummary(out, result) {
	logger.debug(`🧩 Summary:
 • Unique imports expected: ${result?.stats?.expected.size}
 • Unique imports resolved: ${result?.stats?.resolved.size}
`);
	logger.log(`✅ ${out.norm()}`);
}

export function introSummary() {
	CONFIG = getConfig();
	FLAGS = getFlags();

	logger.log(`------- PRODEx RUN @ ${new Date().toLocaleTimeString()} — Codebase decoded -------\n`);
	// Log parse results for testing
	logger.debug("🧩 Parsed CLI input:", _2j({ FLAGS }));
	logger.debug("Final merged config:", _2j(CONFIG));
}

export function entrySummary(entries: string[]) {
	let result = "📋 You selected:";
	for (const e of entries) result += "\n   -" + rel(e);
	if (entries?.length) logger.log(result);
}
