import path from "path";
import { CacheManager } from "../../core/managers/cache";
import type { ProdexConfig } from "../../types";
import { CACHE_KEYS } from "../../constants";
import { globScan } from "../../core/helpers";
import { rel } from "../../shared";
import { normalizePath } from "../../platform/path";

/**
 * 🧩 resolveAliasPath()
 * Unifies alias lookup across config, cache, and fallback discovery.
 *
 * - Checks cfg.resolve.aliases first.
 * - Then cached aliases (from Cache Manager).
 * - If still unresolved, runs Fast-Glob to discover and cache new alias root.
 */
export async function resolveAliasPath(specifier: string, root: string, cfg: ProdexConfig): Promise<string | null> {
	if (!specifier.includes("/")) return null;

	const [aliasName, ...rest] = specifier.split("/");
	const remainder = rest.join("/");
	const knownAliases = cfg.resolve.aliases || {};
	const aliasKey = aliasName.startsWith("@") ? aliasName : `@${aliasName}`;

	// 1️⃣ Check config-defined aliases
	if (knownAliases[aliasKey]) {
		const relPart = remainder.replace(/^\/+/, "");
		return path.resolve(root, knownAliases[aliasKey], relPart);
	}

	// 2️⃣ Check cached aliases
	const cached = CacheManager.get(CACHE_KEYS.ALIASES, aliasKey);

	if (cached) {
		const relPart = remainder.replace(/^\/+/, "");
		return path.resolve(root, cached, relPart);
	}

	// 3️⃣ Fallback discovery with Fast-Glob
	const stripped = remainder; // remove prefix before first '/'
	const hasExt = /\.[a-z0-9]+$/i.test(stripped);
	const patterns = hasExt ? [`**/${stripped}`] : [`**/${stripped}.*`, `**/${stripped}/index.*`];

	const { files: matches } = await globScan(patterns, { cwd: root });

	if (matches.length) {
		const resolvedMatch = resolveMatches(matches, remainder);
		// .replace(/\.[^/.]+$/, "")
		if (!resolvedMatch) return null;
		const relPath = rel(resolvedMatch, cfg.root);
		CacheManager.set(CACHE_KEYS.ALIASES, aliasKey, relPath);
		return relPath;
	}

	return null;
}

function resolveMatches(matches: string[], remainder: string) {
	const foundFile = normalizePath(matches[0]);
	const dSplit = foundFile.split(remainder);
	if (dSplit.length < 2) return "";
	return normalizePath(dSplit[0]);
}
