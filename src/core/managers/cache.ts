import { logger } from "../../lib/logger";

/**
 * 🧩 CacheManager
 * Unified in-memory registry for all runtime maps.
 *
 * - Namespaced storage (e.g., "aliases", "stats", "resolver")
 * - Purely in-memory (no file I/O)
 * - Static API for symmetry with ConfigManager
 */
export class CacheManager {
	private static registry = new Map<string, Map<string, any>>();

	/** Ensure namespace map exists and return it */
	private static ns(ns: string): Map<string, any> {
		if (!this.registry.has(ns)) this.registry.set(ns, new Map());
		return this.registry.get(ns)!;
	}

	/** Set or update a cached entry */
	static set<T = any>(ns: string, key: string, val: T): void {
		this.ns(ns).set(key, val);
		logger.debug(`🧩 [cache:${ns}] set ${key} \n→ ${_2j(val)}`);
	}

	/** Retrieve a cached entry */
	static get<T = any>(ns: string, key: string): T | undefined {
		return this.ns(ns).get(key);
	}

	/** Remove all entries from one namespace or from all */
	static clear(ns?: string): void {
		if (ns) {
			this.ns(ns).clear();
			logger.debug(`🧩 [cache:${ns}] cleared`);
		} else {
			this.registry.forEach((m) => m.clear());
			logger.debug("🧩 [cache] cleared all namespaces");
		}
	}

	/** Export a namespace as a plain object (for persistence or inspection) */
	static dump(ns: string): Record<string, any> {
		return Object.fromEntries(this.ns(ns).entries());
	}

	/** Return count of entries per namespace */
	static stats(): Record<string, number> {
		const summary: Record<string, number> = {};
		for (const [name, map] of this.registry) summary[name] = map.size;
		return summary;
	}
}
