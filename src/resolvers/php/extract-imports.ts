import type { PhpResolverCtx } from "../../types";

/**
 * Extracts PHP use statements and builds an alias/ShortName to FQCN mapping.
 * Handles:
 *  - use Foo\Bar; => { Bar: "Foo\\Bar" }
 *  - use Foo\Bar as Baz; => { Baz: "Foo\\Bar" }
 *  - use App\Models\{User, Team as Group}; => { User: "App\\Models\\User", Group: "App\\Models\\Team" }
 */
export function extractPhpUseMap(code: string): Record<string, string> {
	const useMap: Record<string, string> = {};

	// Match statements like: use App\Models\User; or use App\Models\{User, Team as Group};
	// Skip "use function" or "use const"
	const useStmtRe = /\buse\s+(?!(?:function|const)\s+)([^;]+);/g;
	let match: RegExpExecArray | null;

	while ((match = useStmtRe.exec(code))) {
		const block = match[1].trim();

		// Check if it's a grouped use statement
		const groupMatch = block.match(/^(.+?)\s*{([^}]+)}/);
		if (groupMatch) {
			const base = groupMatch[1].trim().replace(/\\+$/, "");
			const items = groupMatch[2].split(",").map((i) => i.trim()).filter(Boolean);
			for (const item of items) {
				const asMatch = item.match(/^(.+?)\s+as\s+(.+)$/i);
				if (asMatch) {
					const fqcn = `${base}\\${asMatch[1].trim()}`;
					const alias = asMatch[2].trim();
					useMap[alias] = fqcn;
				} else {
					const fqcn = `${base}\\${item}`;
					const shortName = item.split("\\").pop()!;
					useMap[shortName] = fqcn;
				}
			}
		} else {
			// Single or comma-separated use statements (e.g. "Foo\Bar, Foo\Baz")
			const parts = block.split(",").map((p) => p.trim()).filter(Boolean);
			for (const part of parts) {
				const asMatch = part.match(/^(.+?)\s+as\s+(.+)$/i);
				if (asMatch) {
					const fqcn = asMatch[1].trim();
					const alias = asMatch[2].trim();
					useMap[alias] = fqcn;
				} else {
					const fqcn = part;
					const shortName = part.split("\\").pop()!;
					useMap[shortName] = fqcn;
				}
			}
		}
	}

	return useMap;
}

/**
 * Extracts class references, type hints, static calls, and require/include paths.
 */
export function extractPhpReferences(code: string): Set<string> {
	const out = new Set<string>();

	// require/include patterns
	const requireRe = /\b(?:require|include|require_once|include_once)\s*\(?['"]([^'"]+)['"]\)?/g;
	let m: RegExpExecArray | null;
	while ((m = requireRe.exec(code))) {
		const val = m[1];
		if (val) out.add(val);
	}

	// Detect class references (e.g. new User(), User::class, User::method())
	const classPatterns: RegExp[] = [
		/\bnew\s+([A-Za-z0-9_\\]+)\b/g,
		/\b([A-Za-z0-9_\\]+)::class\b/g,
		/\b([A-Za-z0-9_\\]+)::[A-Za-z_]/g,
		/:\s*([A-Za-z0-9_\\]+)\b/g
	];

	for (const r of classPatterns) {
		while ((m = r.exec(code))) {
			const className = m[1].trim();
			if (/^[0-9]+$/.test(className) || ["self", "parent", "static"].includes(className.toLowerCase())) {
				continue;
			}
			out.add(className);
		}
	}

	// Type-hinted parameters in function signatures
	const paramPattern = /\(([^)]*)\)/g;
	while ((m = paramPattern.exec(code))) {
		const block = m[1];
		const params = block.split(",").map((p) => p.trim()).filter(Boolean);
		for (const param of params) {
			const parts = param.split("$");
			if (parts.length > 1) {
				const typePart = parts[0].trim();
				if (typePart) {
					const types = typePart.match(/\b([A-Za-z0-9_\\]+)\b/g);
					if (types) {
						for (const t of types) {
							const trimmedT = t.trim();
							if (
								trimmedT &&
								!/^[0-9]+$/.test(trimmedT) &&
								!["self", "parent", "static", "array", "callable", "string", "int", "bool", "float", "iterable", "object"].includes(trimmedT.toLowerCase())
							) {
								out.add(trimmedT);
							}
						}
					}
				}
			}
		}
	}

	return out;
}

/**
 * Expands grouped `use` imports into individual fully qualified names.
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

/**
 * Resolves a raw PHP reference to a fully qualified class name or path.
 */
export function resolvePhpReference(
	reference: string,
	currentNamespace: string | null,
	useMap: Record<string, string>,
	ctx: PhpResolverCtx
): string | null {
	if (!reference || typeof reference !== "string") return null;

	if (reference.startsWith(".") || reference.includes("/") || reference.endsWith(".php")) {
		return reference;
	}

	const segments = reference.split("\\");
	const firstSegment = segments[0];

	if (useMap[firstSegment]) {
		const remainder = segments.slice(1).join("\\");
		let resolved = remainder ? `${useMap[firstSegment]}\\${remainder}` : useMap[firstSegment];
		resolved = resolved.replace(/^\\+/, "");
		if (ctx.bindings[resolved]) resolved = ctx.bindings[resolved];
		return resolved;
	}

	let resolved = reference;
	const isFullyQualified = resolved.includes("\\") || resolved.startsWith("\\");
	if (!isFullyQualified && currentNamespace) {
		resolved = `${currentNamespace}\\${resolved}`;
	}

	resolved = resolved.replace(/^\\+/, "");

	if (ctx.bindings[resolved]) {
		resolved = ctx.bindings[resolved];
	}

	return resolved;
}

/**
 * Backward-compatible wrapper for extracting raw PHP imports.
 */
export function extractPhpImports(code: string): Set<string> {
	const out = new Set<string>();
	const useMap = extractPhpUseMap(code);
	for (const fqcn of Object.values(useMap)) {
		out.add(fqcn);
	}
	const refs = extractPhpReferences(code);
	for (const ref of refs) {
		out.add(ref);
	}
	return out;
}
