import fs from "fs";
import path from "path";
import { globScan } from "./glob-scan";
import { normalizePath } from "./path";
import { isExcluded } from "../tracing/exclude";

export interface BuildFinalFileSetParams {
	root: string;
	sources: string[];
	include: string[];
	exclude: string[];
}

export async function buildFinalFileSet(params: BuildFinalFileSetParams): Promise<string[]> {
	const { root, sources, include, exclude } = params;
	const absoluteFiles = new Set<string>();

	// 1. Start with selected source files
	for (const src of sources) {
		absoluteFiles.add(normalizePath(path.resolve(root, src)));
	}

	// 2. Resolve and add include path/glob inputs
	const patterns: string[] = [];
	for (const inc of include) {
		const candidate = String(inc ?? "").trim();
		if (!candidate) continue;

		const normalized = normalizePath(candidate);
		if (path.isAbsolute(normalized)) {
			try {
				if (fs.statSync(normalized).isFile()) {
					absoluteFiles.add(normalizePath(path.resolve(normalized)));
					continue;
				}
			} catch {
				// Treat unreadable absolute paths as glob patterns
			}
		}
		patterns.push(normalized);
	}

	if (patterns.length > 0) {
		const { files: scanFiles } = await globScan(patterns, { cwd: root });
		for (const f of scanFiles) {
			absoluteFiles.add(normalizePath(f));
		}
	}

	// 3. Deduplicate (Set takes care of this)
	let list = Array.from(absoluteFiles);

	// 4. Apply exclude path/glob inputs
	list = list.filter((p) => !isExcluded(p, exclude, root));

	// 5. Sort deterministically by root-relative normalized path
	list.sort((a, b) => {
		const relA = normalizePath(path.relative(root, a));
		const relB = normalizePath(path.relative(root, b));
		return relA.localeCompare(relB);
	});

	// 6. Return absolute paths
	return list;
}
