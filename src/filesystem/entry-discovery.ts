import fs from "fs";
import path from "path";
import { globScan } from "./glob-scan";

export const ENTRY_RESOLVE_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".php"];

/**
 * Perform exact/glob match search.
 */
export async function scanGlob(patterns: string[], root: string): Promise<string[]> {
	const { files } = await globScan(patterns, { cwd: root });
	return files;
}

/**
 * For a given path-like input, generate possible extensionless path expansions.
 * Returns only files that physically exist.
 */
export function expandPathLike(pattern: string, root: string): string[] {
	const candidates: string[] = [];
	for (const ext of ENTRY_RESOLVE_EXTS) {
		candidates.push(path.resolve(root, pattern + ext));
		candidates.push(path.resolve(root, pattern, "index" + ext));
	}
	return candidates.filter((candidate) => {
		try {
			const stat = fs.statSync(candidate);
			return stat.isFile();
		} catch {
			return false;
		}
	});
}

/**
 * Searches the workspace for files that match the bare name stem exactly.
 */
export async function discoverBareName(bareName: string, root: string, caseSensitive = false): Promise<string[]> {
	const searchPatterns = [
		`**/${bareName}`,
		...ENTRY_RESOLVE_EXTS.map((ext) => `**/${bareName}${ext}`),
		...ENTRY_RESOLVE_EXTS.map((ext) => `**/${bareName}/index${ext}`),
	];

	const { files } = await globScan(searchPatterns, {
		cwd: root,
		caseSensitiveMatch: caseSensitive,
	});

	const resolvedMatches = new Set<string>();
	const targetStem = caseSensitive ? bareName : bareName.toLowerCase();

	for (const file of files) {
		const absFile = path.resolve(file);
		const ext = path.extname(absFile);
		const extLower = ext.toLowerCase();

		// Ensure extension is empty or is one of the supported extensions
		if (extLower !== "" && !ENTRY_RESOLVE_EXTS.includes(extLower)) {
			continue;
		}

		const stemRaw = path.basename(absFile, ext);
		const stem = caseSensitive ? stemRaw : stemRaw.toLowerCase();
		if (stem === targetStem) {
			resolvedMatches.add(absFile);
		} else if (stem === "index") {
			const parentDirRaw = path.basename(path.dirname(absFile));
			const parentDir = caseSensitive ? parentDirRaw : parentDirRaw.toLowerCase();
			if (parentDir === targetStem) {
				resolvedMatches.add(absFile);
			}
		}
	}

	return Array.from(resolvedMatches);
}
