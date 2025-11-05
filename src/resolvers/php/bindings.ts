import fs from "fs";
import path from "path";
import { CacheManager } from "../../core/managers/cache";
import { CACHE_KEYS } from "../../constants/cache-keys";

/**
 * Scans app/Providers/*.php for `$this->app->bind()` / `singleton()` calls
 * and returns a map of Interface::class → Implementation::class (FQCN strings).
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

	// $this->app->bind(Interface::class, Implementation::class)
	// $this->app->singleton(Interface::class, Implementation::class)
	const re = /\$this->app->(?:bind|singleton)\s*\(\s*([A-Za-z0-9_:\\\\]+)::class\s*,\s*([A-Za-z0-9_:\\\\]+)::class/g;

	for (const file of files) {
		const code = fs.readFileSync(file, "utf8");
		let m: RegExpExecArray | null;
		while ((m = re.exec(code))) {
			const iface = m[1].replace(/\\\\/g, "\\");
			const impl = m[2].replace(/\\\\/g, "\\");
			bindings[iface] = impl;
		}
	}

	CacheManager.set(CACHE_KEYS.PHP_BINDINGS, root, bindings);

	return bindings;
}
