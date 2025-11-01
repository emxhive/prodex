import { logger } from "../lib/logger";
import { rel } from "../core/helpers";

export function endSummary(out, result) {
	logger.debug(`🧩 Summary:
 • Unique imports expected: ${result.stats.expected.size}
 • Unique imports resolved: ${result.stats.resolved.size}
`);
	logger.log(`✅ ${out.norm()}`);
}

export function introSummary({ flags, config }) {
	logger.log(`------- PRODEx RUN @ ${new Date().toLocaleTimeString()} — Codebase decoded -------`);
	// Log parse results for testing
	logger.debug("🧩 Parsed CLI input:", _2j({ flags }));
	logger.debug("Final merged config:", _2j(config));
}

export function entrySummary(entries: string[]) {
	let result = "📋 You selected:";
	for (const e of entries) result += "\n   -" + rel(e);
	logger.log(result);
}
