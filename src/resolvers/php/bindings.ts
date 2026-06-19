import fs from "fs";
import path from "path";
import { CacheManager } from "../../cache/cache-manager";
import { CACHE_KEYS } from "../../cache/cache-keys";
import { extractPhpImports, expandGroupedUses } from "./extract-imports";
import { logger } from "../../diagnostics/logger";

/**
 * Scans app/Providers/*.php for $this->app->bind() / singleton() calls
 * and returns a map of InterfaceFQCN to ImplementationFQCN.
 *
 * Uses existing extractPhpImports + expandGroupedUses to correctly
 * resolve namespaces and short class names.
 */
export function loadLaravelBindings(root: string): Record<string, string> {
	const cached = CacheManager.get(CACHE_KEYS.PHP_BINDINGS, root);
	if (cached) return cached;

	const providersDir = path.join(root, "app", "Providers");
	const bindings: Record<string, string> = {};

	if (!fs.existsSync(providersDir)) {
		CacheManager.set(CACHE_KEYS.PHP_BINDINGS, root, bindings);
		return bindings;
	}

	const files = fs
		.readdirSync(providersDir)
		.filter((f) => f.endsWith(".php"))
		.map((f) => path.join(providersDir, f));

	for (const file of files) {
		const code = fs.readFileSync(file, "utf8");

		// 1️⃣ Extract all imports in the provider
		const rawImports = extractPhpImports(code);
		const expanded = expandGroupedUses(rawImports);

		const importMap: Record<string, string> = {};
		for (const fqcn of expanded) {
			const short = fqcn.split("\\").pop()!;
			importMap[short] = fqcn;
		}

		// 2️⃣ Extract bindings
		const bindRe = /\$this->app->(?:bind|singleton)\s*\(\s*\\?([A-Za-z0-9_\\]+)::class\s*,\s*\\?([A-Za-z0-9_\\]+)::class/g;

		let m: RegExpExecArray | null;
		while ((m = bindRe.exec(code))) {
			const ifaceRaw = m[1].replace(/^\\+/, "");
			const implRaw = m[2].replace(/^\\+/, "");

			const ifaceFull = importMap[ifaceRaw] || ifaceRaw;
			const implFull = importMap[implRaw] || implRaw;

			logger.debug(`[laravel-bindings] ${file} => ${ifaceFull} => ${implFull}`);
			bindings[ifaceFull] = implFull;
		}
	}

	CacheManager.set(CACHE_KEYS.PHP_BINDINGS, root, bindings);
	return bindings;
}
