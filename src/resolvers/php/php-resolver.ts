import fs from "fs";
import path from "path";
import { extractPhpImports, expandGroupedUses } from "./extract-imports";
import { loadLaravelBindings } from "./bindings";
import { resolvePsr4 } from "./psr4";
import { logger } from "../../lib/logger";
import { newStats, mergeStats, unique, readFileSafe, setDiff, isExcluded } from "../../shared";
import type { ResolverParams, ResolverResult, PhpResolverCtx } from "../../types";
import { CACHE_KEYS } from "../../constants";
import { CacheManager } from "../../core/managers/cache";
import { emptyResult } from "../../shared/collections";
import fsp from "fs/promises"; // (add near the top if not present)
import { normalizePath } from "../../platform/path";

/**
 * Typed PHP resolver (aligned with JS resolver signature).
 * - Returns ResolverResult (files + stats)
 * - Depth/visited guarded recursion
 */
export async function resolvePhpImports({ cfg, filePath, visited = new Set<string>(), depth = 0, maxDepth, ctx }: ResolverParams): Promise<ResolverResult> {
	const {
		root: ROOT,
		exclude: excludePatterns = [],
	} = cfg;

	const limitDepth = maxDepth ?? cfg.resolve.maxDepth;

	if (depth >= limitDepth) return emptyResult(visited);
	if (visited.has(filePath)) return emptyResult(visited);
	visited.add(filePath);

	// Fast existence / read
	if (!fs.existsSync(filePath)) return emptyResult(visited);
	const code = readFileSafe(filePath);
	if (!code) return emptyResult(visited);

	const nsMatch = code.match(/\bnamespace\s+([^;]+);/);
	const currentNamespace = nsMatch ? nsMatch[1].trim() : null;

	// Context + exclusions
	const phpCtx = buildPhpCtx(ROOT, ctx as PhpResolverCtx | undefined);

	// Parse imports (expand grouped `use` syntax)
	const raw = extractPhpImports(code);
	const imports = expandGroupedUses(raw);

	// Accumulators
	const stats = newStats();
	const filesOut: string[] = [];

	for (const imp0 of imports) {
		let imp = imp0;
		if (!imp || typeof imp !== "string") continue;

		// Fully-qualified check
		const isFullyQualified = imp.includes("\\") || imp.startsWith("\\");

		if (!isFullyQualified && currentNamespace) {
			imp = `${currentNamespace}\\${imp}`;
		}

		// Respect Laravel container bindings (Interface → Implementation)
		if (phpCtx.bindings[imp]) {
			imp = phpCtx.bindings[imp];
		}

		// Only resolve PSR-4 mapped namespaces
		if (!startsWithAnyNamespace(imp, phpCtx.nsKeys)) continue;

		// Resolve namespace → file path (sync helper retained)
		const resolvedPath = await tryResolvePhpFile(imp, filePath, phpCtx.psr4);

		// Exclusion check after final resolution
		if (isExcluded(resolvedPath, excludePatterns, ROOT)) continue;
		stats.expected.add(imp);
		if (!resolvedPath) continue;

		stats.resolved.add(imp);
		filesOut.push(resolvedPath);

		// Recurse
		const sub = await resolvePhpImports({
			cfg,
			filePath: resolvedPath,
			visited,
			depth: depth + 1,
			maxDepth: limitDepth,
			ctx: phpCtx,
		});

		filesOut.push(...sub.files);
		mergeStats(stats, sub.stats);
	}

	const out = unique(filesOut);
	const unresolved = setDiff(stats.expected, stats.resolved);
	logger.debug(`🪶 [php-resolver] ${path.basename(filePath)} → expected: ${stats.expected.size}, resolved: ${stats.resolved.size}`);
	if (unresolved.size) logger.debug("[php-resolver] unresolved:", [...unresolved]);

	return { files: out, visited, stats };
}

async function tryResolvePhpFile(imp: string, fromFile: string, psr4: Record<string, string>): Promise<string | null> {
	const key = `php:${imp}:${fromFile}`;
	const cached = CacheManager.get(CACHE_KEYS.PHP_FILECACHE, key);
	if (cached !== undefined) return cached;

	const nsKey = Object.keys(psr4).find((k) => imp.startsWith(k));
	if (!nsKey) {
		CacheManager.set(CACHE_KEYS.PHP_FILECACHE, key, null);
		return null;
	}

	const rel = normalizePath(imp.replace(nsKey, ""));
	const tries = [path.join(psr4[nsKey], rel), path.join(psr4[nsKey], rel + ".php"), path.join(psr4[nsKey], rel, "index.php")];

	// 🔹 Run all stats concurrently
	const results = await Promise.allSettled(
		tries.map(async (p) => {
			try {
				const st = await fsp.stat(p);
				return st.isFile() ? path.resolve(p) : null;
			} catch {
				return null;
			}
		})
	);

	//@ts-ignore
	const resolved = results.find((r) => r.status === "fulfilled" && r.value)?.value ?? null;
	CacheManager.set(CACHE_KEYS.PHP_FILECACHE, key, resolved);
	return resolved;
}

/** Ensure we have a PHP resolver context for the current root */
function buildPhpCtx(root: string, prev?: PhpResolverCtx): PhpResolverCtx {
	if (prev?.kind === "php") return prev;
	const psr4 = resolvePsr4(root);
	const nsKeys = Object.keys(psr4).sort((a, b) => b.length - a.length);
	const bindings = loadLaravelBindings(root);
	return { kind: "php", psr4, nsKeys, bindings };
}

/** Namespace prefix check */
function startsWithAnyNamespace(imp: string, nsKeys: string[]): boolean {
	for (const k of nsKeys) if (imp.startsWith(k)) return true;
	return false;
}
