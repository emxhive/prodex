import path from "path";
import { CacheManager } from "../../cache/cache-manager";
import type { ProdexConfig } from "../../types";
import { CACHE_KEYS } from "../../cache/cache-keys";
import { globScan } from "../../filesystem/glob-scan";
import { rel } from "../../filesystem/read-file";
import { normalizePath } from "../../filesystem/path";

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
	const stripped = remainder;
	const hasExt = /\.[a-z0-9]+$/i.test(stripped);
	const patterns = hasExt ? [`**/${stripped}`] : [`**/${stripped}.*`, `**/${stripped}/index.*`];

	const { files: matches } = await globScan(patterns, { cwd: root });

	if (matches.length) {
		const resolvedMatch = resolveMatches(matches, remainder);
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
