import fs from "fs/promises";
import path from "path";
import micromatch from "micromatch";
import { extractImports } from "../../core/parsers/extract-imports";
import { loadProjectAliases } from "./alias-loader";
import { BASE_EXTS, DTS_EXT, REAL_EXTS } from "../../constants/config";
import { setDiff, unique } from "../../lib/utils";
import { logger } from "../../lib/logger";
import { getConfig } from "../../store";
import type { ResolverParams, ResolverResult, JsResolverCtx } from "../../types";

// ---------------------------------------------------------
// 🧩 JS Resolver — absolute-path, config-getter version
// ---------------------------------------------------------

const IMPORTS_CACHE: Map<string, Set<string>> = new Map();
const STAT_CACHE: Map<string, import("fs").Stats | null> = new Map();

// ---------------------------------------------------------
// Entry
// ---------------------------------------------------------
export async function resolveJsImports({ filePath, visited = new Set(), depth = 0, maxDepth, ctx }: ResolverParams): Promise<ResolverResult> {
	const limitDepth = maxDepth;

	if (depth >= limitDepth) return empty(visited);
	if (visited.has(filePath)) return empty(visited);
	visited.add(filePath);

	const {
		root: ROOT,
		resolve: { exclude: excludePatterns, aliases },
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

	// Context (aliases) -------------------------------------
	const jsCtx: JsResolverCtx =
		ctx?.kind === "js"
			? (ctx as JsResolverCtx)
			: {
					kind: "js",
					aliases: {
						...loadProjectAliases(ROOT),
						...(aliases || {}),
					},
			  };

	// Extract imports ---------------------------------------
	const imports = await getImportsCached(filePath, code);
	if (!imports.size) return empty(visited);

	// Trackers ----------------------------------------------
	const expected = new Set<string>();
	const resolved = new Set<string>();
	const files: string[] = [];

	// Main resolution loop ----------------------------------
	for (const imp of imports) {
		if (!imp.startsWith(".") && !imp.startsWith("/") && !startsWithAnyAlias(imp, jsCtx.aliases)) continue;

		if (isExcluded(imp)) continue;

		const base = resolveBasePath(filePath, imp, jsCtx.aliases);
		if (!base) continue;

		const absBase = path.resolve(base);
		expected.add(absBase);

		const resolvedPath = await tryResolveImport(absBase);
		if (!resolvedPath) continue;

		resolved.add(absBase);
		files.push(resolvedPath);

		const sub = await resolveJsImports({
			filePath: resolvedPath,
			visited,
			depth: depth + 1,
			maxDepth: limitDepth,
			ctx: jsCtx,
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
// Helpers
// ---------------------------------------------------------

function startsWithAnyAlias(imp: string, aliases: Record<string, string>): boolean {
	for (const a of Object.keys(aliases)) {
		if (imp === a || imp.startsWith(a + "/")) return true;
	}
	return false;
}

function resolveBasePath(fromFile: string, specifier: string, aliases: Record<string, string>): string | null {
	if (specifier.startsWith("@")) {
		const key = Object.keys(aliases)
			.filter((a) => specifier === a || specifier.startsWith(a + "/"))
			.sort((a, b) => b.length - a.length)[0];
		if (!key) return null;
		const relPart = specifier.slice(key.length).replace(/^\/+/, "");
		return path.resolve(aliases[key], relPart);
	}

	if (specifier.startsWith(".")) {
		return path.resolve(path.dirname(fromFile), specifier);
	}

	if (specifier.startsWith("/")) {
		return path.resolve(specifier);
	}

	return null;
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
