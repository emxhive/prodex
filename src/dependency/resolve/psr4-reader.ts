import fs from "node:fs";
import path from "node:path";

export interface Psr4Map {
	[prefix: string]: string | string[];
}

export interface Psr4ReadResult {
	composerPath: string;
	map: Record<string, string | string[]>;
}

export class Psr4Reader {
	private static cache = new Map<string, Psr4ReadResult>();

	static read(root: string): Record<string, string | string[]> {
		return this.readWithMetadata(root).map;
	}

	static readWithMetadata(root: string): Psr4ReadResult {
		const cached = this.cache.get(root);
		if (cached) return cached;

		const composerPath = path.join(root, "composer.json");
		const map: Record<string, string | string[]> = {};
		const result = { composerPath, map };

		if (!fs.existsSync(composerPath)) {
			this.cache.set(root, result);
			return result;
		}

		try {
			const content = fs.readFileSync(composerPath, "utf8");
			const json = JSON.parse(content);
			const psr4 = json?.autoload?.["psr-4"] || {};

			for (const ns in psr4) {
				// Normalize namespace suffix: strip trailing backslash
				const cleanNs = ns.replace(/\\+$/, "");
				const val = psr4[ns];

				if (Array.isArray(val)) {
					map[cleanNs] = val.map((v) => path.resolve(root, v));
				} else {
					map[cleanNs] = path.resolve(root, val);
				}
			}
		} catch {
			// Fail silently, return empty mapping
		}

		this.cache.set(root, result);
		return result;
	}

	static clearCache(): void {
		this.cache.clear();
	}
}
