import { logger } from "../diagnostics/logger";
import { inspectValue } from "../filesystem/inspect";

export class CacheManager {
	private static registry = new Map<string, Map<string, any>>();

	private static ns(ns: string): Map<string, any> {
		if (!this.registry.has(ns)) this.registry.set(ns, new Map());
		return this.registry.get(ns)!;
	}

	static set<T = any>(ns: string, key: string, val: T): void {
		this.ns(ns).set(key, val);
		logger.debug(`[cache:${ns}] set ${key}\n-> ${inspectValue(val)}`);
	}

	static get<T = any>(ns: string, key: string): T | undefined {
		return this.ns(ns).get(key);
	}

	static clear(ns?: string): void {
		if (ns) {
			this.ns(ns).clear();
			logger.debug(`[cache:${ns}] cleared`);
		} else {
			this.registry.forEach((m) => m.clear());
			logger.debug("[cache] cleared all namespaces");
		}
	}

	static dump(ns: string): Record<string, any> {
		return Object.fromEntries(this.ns(ns).entries());
	}

	static stats(): Record<string, number> {
		const summary: Record<string, number> = {};
		for (const [name, map] of this.registry) summary[name] = map.size;
		return summary;
	}
}
