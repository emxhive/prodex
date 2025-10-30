import { logger } from "../lib/logger";

export function showSummary({ outDir, fileName, entries }) {
  logger.debug(`🧩 Active Run → ${fileName} (${entries.length} entries)`);
}


export function importSummary(result) {
  logger.debug(`\n🧩 Summary:
 • Unique imports expected: ${result.stats.expected.size}
 • Unique imports resolved: ${result.stats.resolved.size}
`);
}

