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
 * Searches for files matching the suffix-path target.
 * target is path-like, e.g. "src/target.tsx" or "src/target".
 */
export async function discoverBySuffixPath(
	target: string,
	root: string,
	caseSensitive: boolean,
	hasExt: boolean
): Promise<string[]> {
	// Normalize target separators to '/'
	const normalizedTarget = target.replaceAll("\\", "/");

	const suffixes: string[] = [];
	if (hasExt) {
		suffixes.push(normalizedTarget);
	} else {
		suffixes.push(normalizedTarget);
		for (const ext of ENTRY_RESOLVE_EXTS) {
			suffixes.push(normalizedTarget + ext);
			suffixes.push(normalizedTarget + "/index" + ext);
		}
	}

	const globPatterns = suffixes.map((s) => `**/${s}`);

	const { files } = await globScan(globPatterns, {
		cwd: root,
		caseSensitiveMatch: caseSensitive,
	});

	const resolvedMatches = new Set<string>();

	for (const file of files) {
		const absFile = path.resolve(root, file);
		const relFile = path.relative(root, absFile).replaceAll("\\", "/");

		for (const suffix of suffixes) {
			const relFileToCompare = caseSensitive ? relFile : relFile.toLowerCase();
			const suffixToCompare = caseSensitive ? suffix : suffix.toLowerCase();

			if (relFileToCompare === suffixToCompare || relFileToCompare.endsWith("/" + suffixToCompare)) {
				resolvedMatches.add(absFile);
				break;
			}
		}
	}

	return Array.from(resolvedMatches);
}

/**
 * Searches for files matching the full basename target (bare, extension-bearing, e.g. "target.tsx").
 */
export async function discoverByFullBasename(
	target: string,
	root: string,
	caseSensitive: boolean
): Promise<string[]> {
	// target is a bare name like "target.tsx"
	const searchPattern = `**/${target}`;

	const { files } = await globScan([searchPattern], {
		cwd: root,
		caseSensitiveMatch: caseSensitive,
	});

	const resolvedMatches = new Set<string>();
	const targetBasename = caseSensitive ? target : target.toLowerCase();

	for (const file of files) {
		const absFile = path.resolve(root, file);
		const base = path.basename(absFile);
		const baseToCompare = caseSensitive ? base : base.toLowerCase();

		if (baseToCompare === targetBasename) {
			resolvedMatches.add(absFile);
		}
	}

	return Array.from(resolvedMatches);
}

/**
 * Searches the workspace for files that match the bare name stem exactly (stem/index discovery).
 */
export async function discoverBareName(
	bareName: string,
	root: string,
	caseSensitive: boolean
): Promise<string[]> {
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
		const absFile = path.resolve(root, file);
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
