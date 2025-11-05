import fs from "fs";
import micromatch from "micromatch";
import { ProdexConfig } from "../types";
import { isExcluded, rel, unique } from "../shared";

import path from "path";
import fg, { Options } from "fast-glob";

import { GLOBAL_IGNORE } from "../constants";
import { logger } from "../lib/logger";

/**
 * Recursive walker that respects glob exclude.
 * Returns all files under the given directory tree.
 */
export function* walk(dir, cfg: ProdexConfig, depth = 0) {
	const {
		root,
		entry: {
			ui: { scanDepth },
		},
		resolve: { exclude },
	} = cfg;

	if (depth > scanDepth) return;

	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const e of entries) {
		const full = path.join(dir, e.name);

		if (e.isDirectory()) {
			// Skip excluded directories entirely
			const relPath = rel(full, root);
			if (isExcluded(relPath, exclude)) continue;
			yield* walk(full, cfg, depth + 1);
			continue;
		}

		if (e.isFile()) {
			const relPath = rel(full, root);
			if (isExcluded(relPath, exclude)) continue;
			yield full;
		}
	}
}

export function orderByPriority(files, priorityList = []) {
	if (!priorityList.length) return files;
	const prioritized = [];
	const normal = [];

	for (const f of files) {
		const normalized = f.norm().toLowerCase();
		if (priorityList.some((p) => micromatch.isMatch(normalized, p.toLowerCase()))) prioritized.push(f);
		else normal.push(f);
	}

	return unique([...prioritized, ...normal]);
}
export function smartNaming(entries: string[]): string {
	const names = unique(entries.map((f) => path.basename(f, path.extname(f))));
	if (names.length === 1) return names[0];
	if (names.length === 2) return `${names[0]}-${names[1]}`;
	if (names.length > 2) return `${names[0]}-and-${names.length - 1}more`;
	return "prodex";
}



/**
 * Safe micromatch.scan wrapper (compatible with micromatch v4 & v5)
 */

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
	).map((f) => path.resolve(f));
	logger.debug("globScan →", _2j(files));

	return { files };
}
