import path from "path";
import fg, { Options } from "fast-glob";
import { logger } from "../diagnostics/logger";
import { inspectValue } from "./inspect";

const GLOBAL_IGNORE = ["**/node_modules/**", "**/vendor/**", "**/dist/**"];

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
