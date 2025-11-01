import path from "path";
import fg, { Options } from "fast-glob";
import { GLOBAL_IGNORE } from "../constants/config";
import { logger } from "../lib/logger";
import { unique } from "../lib/utils";

/**
 * Safe micromatch.scan wrapper (compatible with micromatch v4 & v5)
 */
export async function globScan(patterns: string[], opts: Options) {
	logger.debug("PATTERNS", patterns);
	const { absolute = true, cwd = process.cwd() } = opts;

	if (!patterns?.length) return { files: [] };
	const files = (
		await fg(patterns, {
			cwd,
			extglob: true,
			dot: true,
			onlyFiles: true,
			ignore: GLOBAL_IGNORE,
			absolute,
		})
	).map((f) => path.resolve(f));
	logger.debug("GLOB-SCAN_FILES ", _2j(files));

	return { files };
}

export function produceSmartName(entries: string[]): string {
	const names = unique(entries.map((f) => path.basename(f, path.extname(f))));
	if (names.length === 1) return names[0];
	if (names.length === 2) return `${names[0]}-${names[1]}`;
	if (names.length > 2) return `${names[0]}-and-${names.length - 1}more`;
	return "unknown";
}
