import fs from "fs";
import path from "path";
import { CacheManager } from "../../../cache/cache-manager";
import { CACHE_KEYS } from "../../../cache/cache-keys";

/**
 * Builds a PSR-4 namespace to directory map from composer.json.
 * Returns absolute paths in the map values.
 */
export function resolvePsr4(root: string): Record<string, string | string[]> {
	const cached = CacheManager.get(CACHE_KEYS.PHP_PSR4, root);
	if (cached) return cached;

	const composer = path.join(root, "composer.json");
	if (!fs.existsSync(composer)) {
		CacheManager.set(CACHE_KEYS.PHP_PSR4, root, {});
		return {};
	}

	try {
		const data = JSON.parse(fs.readFileSync(composer, "utf8")) as {
			autoload?: { ["psr-4"]?: Record<string, string | string[]> };
		};
		const src = data.autoload?.["psr-4"] || {};
		const map: Record<string, string | string[]> = {};

		for (const ns in src) {
			const cleanNs = ns.replace(/\\+$/, "");
			const val = src[ns];
			if (Array.isArray(val)) {
				map[cleanNs] = val.map((v) => path.resolve(root, v));
			} else {
				map[cleanNs] = path.resolve(root, val);
			}
		}

		CacheManager.set(CACHE_KEYS.PHP_PSR4, root, map);
		return map;
	} catch {
		CacheManager.set(CACHE_KEYS.PHP_PSR4, root, {});
		return {};
	}
}
