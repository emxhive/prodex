import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";
import type { CacheRegistry } from "../types";

/**
 * 🧩 Central Cache Manager — Alias Focused
 * Keeps Prodex configuration immutable while allowing
 * resolvers to discover and store aliases during runtime.
 */
const registry: CacheRegistry = {
	aliases: new Map(),
};

/** 🔹 Clear all caches or a specific namespace */
export function clearCache(namespace?: keyof CacheRegistry): void {
	if (namespace) registry[namespace].clear();
	else Object.values(registry).forEach((m) => m.clear());
}

/** 🔹 Set or update a cache entry */
export function setCache<K extends keyof CacheRegistry>(namespace: K, key: string, value: string): void {
	registry[namespace].set(key, value);
	if (namespace === "aliases") {
		logger.debug(`🧩 Cached alias: ${key} → ${value}`);
	}
}

/** 🔹 Retrieve a cached entry */
export function getCache<K extends keyof CacheRegistry>(namespace: K, key: string): string | undefined {
	return registry[namespace].get(key);
}

/** 🔹 Get all aliases as a plain object (for saving) */
export function exportAliases(): Record<string, string> {
	return Object.fromEntries(registry.aliases.entries());
}

/** 🔹 Merge discovered aliases into config before persistence */
export function mergeAliasesIntoConfig(cfg: any): any {
	const discovered = exportAliases();
	if (!Object.keys(discovered).length) return cfg;

	const merged = {
		...cfg,
		resolve: {
			...cfg.resolve,
			aliases: {
				...cfg.resolve.aliases,
				...discovered,
			},
		},
	};

	return merged;
}

/**
 * 🔹 Persist merged aliases into prodex.json
 * Safe no-op if no new aliases were discovered.
 */
export async function persistAliases(cfg: any): Promise<void> {
	const discovered = exportAliases();
	if (!Object.keys(discovered).length) {
		logger.debug("🧩 No new aliases to persist.");
		return;
	}

	const dest = path.join(cfg.root, "prodex.json");
	try {
		const existing = JSON.parse(fs.readFileSync(dest, "utf8"));
		const merged = mergeAliasesIntoConfig(existing);

		fs.writeFileSync(dest, JSON.stringify(merged, null, 2) + "\n", "utf8");
		logger.info(`✅ ${Object.keys(discovered).length} new alias(es) saved to prodex.json`);
	} catch (err: any) {
		logger.warn("⚠️ Failed to persist aliases:", err.message || err);
	}
}
