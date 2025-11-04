import fs from "fs/promises";
import path from "path";
import micromatch from "micromatch";
import { extractImports } from "../../core/parsers/extract-imports";
import { BASE_EXTS, DTS_EXT, REAL_EXTS } from "../../constants/config";
import { setDiff, unique } from "../../lib/utils";
import { logger } from "../../lib/logger";
import { getConfig } from "../../store";
import { resolveAliasPath } from "../shared/resolve-alias"; // alias: config + cache + fast-glob
import type { ResolverParams, ResolverResult } from "../../types";

// ---------------------------------------------------------
// 🧩 JS Resolver — alias cache + fast-glob discovery
// ---------------------------------------------------------

const IMPORTS_CACHE: Map<string, Set<string>> = new Map();
const STAT_CACHE: Map<string, import("fs").Stats | null> = new Map();

// ---------------------------------------------------------
// Entry
// ---------------------------------------------------------
export async function resolveJsImports({ filePath, visited = new Set(), depth = 0, maxDepth }: ResolverParams): Promise<ResolverResult> {
	const limitDepth = maxDepth;

	if (depth >= limitDepth) return empty(visited);
	if (visited.has(filePath)) return empty(visited);
	visited.add(filePath);

	const {
		root: ROOT,
		resolve: { exclude: excludePatterns },
	} = getConfig();

	const isExcluded = micromatch.matcher(excludePatterns);

	const ext = path.extname(filePath).toLowerCase();
	const isDts = ext === DTS_EXT;
	if (!BASE_EXTS.includes(ext) && !isDts) return empty(visited);

	let code = "";
	try {
		code = await fs.readFile(filePath, "utf8");
	} catch {
		return empty(visited);
	}

	// Extract imports ---------------------------------------
	const imports = await getImportsCached(filePath, code);
	if (!imports.size) return empty(visited);

	// Trackers ----------------------------------------------
	const expected = new Set<string>();
	const resolved = new Set<string>();
	const files: string[] = [];

	// Main resolution loop ----------------------------------
	for (const imp of imports) {
		// skip bare packages (react, lodash, etc.)
		if (!imp.startsWith(".") && !imp.startsWith("/") && !imp.startsWith("@")) continue;
		if (isExcluded(imp)) continue;

		let base: string | null = null;

		if (imp.startsWith(".")) {
			// relative → like original resolver
			base = path.resolve(path.dirname(filePath), imp);
		} else if (imp.startsWith("/")) {
			// absolute path import → like original resolver
			base = path.resolve(imp);
		} else {
			// alias (@...) → unified resolver (config + cache + glob)
			base = await resolveAliasPath(imp, ROOT, getConfig());
		}

		if (!base) continue;

		const absBase = path.resolve(base);
		expected.add(absBase);

		const resolvedPath = await tryResolveImport(absBase);
		if (!resolvedPath) continue;

		resolved.add(absBase);
		files.push(resolvedPath);

		// Recursive traversal
		const sub = await resolveJsImports({
			filePath: resolvedPath,
			visited,
			depth: depth + 1,
			maxDepth: limitDepth,
		});

		files.push(...sub.files);
		for (const e of sub.stats.expected) expected.add(e);
		for (const r of sub.stats.resolved) resolved.add(r);
	}

	const uniqueFiles = unique(files);
	const diff = setDiff(expected, resolved);

	logger.debug(`🪶 [js-resolver] ${filePath} → expected: ${expected.size}, resolved: ${resolved.size}`);
	if (diff.size) logger.debug([...diff], "🔴 THE diff");

	return { files: uniqueFiles, visited, stats: { expected, resolved } };
}

// ---------------------------------------------------------
// tryResolveImport (pure)
// ---------------------------------------------------------
async function tryResolveImport(basePath: string): Promise<string | null> {
	const candidates: string[] = [];

	const ext = path.extname(basePath).toLowerCase();
	if (ext && REAL_EXTS.has(ext)) {
		candidates.push(basePath);
	} else {
		for (const e of [...BASE_EXTS, DTS_EXT]) {
			candidates.push(basePath + e);
			candidates.push(path.join(basePath, "index" + e));
		}
	}

	for (const c of candidates) {
		const abs = path.resolve(c);
		const st = await safeStat(abs);
		if (st && st.isFile()) return abs;
	}

	return null;
}

// ---------------------------------------------------------
// Cached stat + import scanners
// ---------------------------------------------------------
async function safeStat(p: string): Promise<import("fs").Stats | null> {
	if (STAT_CACHE.has(p)) return STAT_CACHE.get(p)!;
	try {
		const st = await fs.stat(p);
		STAT_CACHE.set(p, st);
		return st;
	} catch {
		STAT_CACHE.set(p, null);
		return null;
	}
}

async function getImportsCached(filePath: string, code: string): Promise<Set<string>> {
	if (IMPORTS_CACHE.has(filePath)) return IMPORTS_CACHE.get(filePath)!;
	const set = await extractImports(filePath, code);
	IMPORTS_CACHE.set(filePath, set);
	return set;
}

// ---------------------------------------------------------
function empty(visited: Set<string>): ResolverResult {
	return { files: [], visited, stats: { expected: new Set(), resolved: new Set() } };
}
