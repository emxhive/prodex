import type { PhpResolverCtx } from "../../types";

/**
 * Extracts import-like references from PHP code.
 * Supports:
 *  - require/include/require_once/include_once
 *  - use statements (including grouped imports like `use App\Models\{User, Team};`)
 */
export function extractPhpImports(code: string): Set<string> {
	const out = new Set<string>();

	const patterns: RegExp[] = [/\b(?:require|include|require_once|include_once)\s*\(?['"]([^'"]+)['"]\)?/g, /\buse\s+([A-Z][\w\\]+(?:\s*{[^}]+})?)/g];

	for (const r of patterns) {
		let m: RegExpExecArray | null;
		while ((m = r.exec(code))) {
			const val = m[1];
			if (val) out.add(val);
		}
	}

	// Detect short class names
	const shortClassPatterns: RegExp[] = [/\bnew\s+([A-Z][A-Za-z0-9_]*)\b/g, /\b([A-Z][A-Za-z0-9_]*)::class\b/g, /\b([A-Z][A-Za-z0-9_]*)::[A-Za-z_]/g, /:\s*([A-Z][A-Za-z0-9_]*)\b/g];

	// Direct matches
	for (const r of shortClassPatterns) {
		let m;
		while ((m = r.exec(code))) out.add(m[1]);
	}

	// Type-hinted parameters in function signatures
	let m;
	const paramPattern = /\(([^)]*)\)/g;
	while ((m = paramPattern.exec(code))) {
		const block = m[1];
		const types = block.match(/\b([A-Z][A-Za-z0-9_]*)\b/g);
		if (types) types.forEach((t) => out.add(t));
	}

	return out;
}

/**
 * Expands grouped `use` imports into individual fully qualified names.
 * Example:
 *   "App\\Models\\{User, Team}" to ["App\\Models\\User", "App\\Models\\Team"]
 */
export function expandGroupedUses(raw: Set<string>): Set<string> {
	const out = new Set<string>();
	for (const imp of raw) {
		const g = imp.match(/^(.+?)\s*{([^}]+)}/);
		if (g) {
			const base = g[1].trim().replace(/\\+$/, "");
			g[2]
				.split(",")
				.map((x) => x.trim())
				.filter(Boolean)
				.forEach((p) => out.add(`${base}\\${p}`));
		} else {
			out.add(imp.trim());
		}
	}
	return out;
}
