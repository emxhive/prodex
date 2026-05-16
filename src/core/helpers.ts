import path from "path";
import fg, { Options } from "fast-glob";
import { GLOBAL_IGNORE } from "../constants";
import { logger } from "../lib/logger";
import { unique } from "../shared";
import { inspectValue } from "../platform/inspect";

export function smartNaming(entries: string[]): string {
	const names = unique(entries.map((file) => path.basename(file, path.extname(file))));
	if (names.length === 1) return names[0];
	if (names.length === 2) return `${names[0]}-${names[1]}`;
	if (names.length > 2) return `${names[0]}-and-${names.length - 1}more`;
	return "prodex";
}

export async function globScan(patterns: string[], opts: Options) {
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
	).map((file) => path.resolve(file));

	logger.debug("globScan ->", inspectValue(files));
	return { files };
}
