import { ParsedTsConfig, parseTsConfig } from "./config-parser";

/**
 * Scoped cache for storing parsed TSConfig structures.
 * Typically instantiated per resolver/provider run or resolver instance.
 */
export class ConfigCache {
	private tsConfigCache = new Map<string, ParsedTsConfig>();

	getParsedTsConfig(filePath: string): ParsedTsConfig {
		let cached = this.tsConfigCache.get(filePath);
		if (!cached) {
			cached = parseTsConfig(filePath);
			this.tsConfigCache.set(filePath, cached);
		}
		return cached;
	}

	clear(): void {
		this.tsConfigCache.clear();
	}
}
