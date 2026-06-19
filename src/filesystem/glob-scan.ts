import path from "path";
import fg, { Options } from "fast-glob";
import { logger } from "../diagnostics/logger";
import { inspectValue } from "./inspect";
import { normalizePath } from "./path";

export interface GlobScanOptions {
	cwd?: string;
	caseSensitiveMatch?: boolean;
	ignore?: string[];
}

export async function globScan(patterns: string[], opts: GlobScanOptions = {}) {
	const { cwd = process.cwd(), caseSensitiveMatch, ignore } = opts;

	if (!patterns?.length) return { files: [] };

	const rawFiles = await fg(patterns, {
		cwd,
		extglob: true,
		dot: true,
		onlyFiles: true,
		ignore,
		absolute: true,
		caseSensitiveMatch,
	});

	// Slash normalization & absolute path resolution
	const files = rawFiles.map((file) => normalizePath(path.resolve(cwd, file)));

	// Deterministic file sorting
	files.sort();

	logger.debug("globScan ->", inspectValue(files));
	return { files };
}
