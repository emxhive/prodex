import type { PhpResolverCtx } from "../../types";

/**
 * Extracts import-like references from PHP code.
 * Supports:
 *  - require/include/require_once/include_once
 *  - use statements (including grouped imports like `use App\Models\{User, Team};`)
 */
export function extractPhpImports(code: string): Set<string> {
  const out = new Set<string>();

  const patterns: RegExp[] = [
    /\b(?:require|include|require_once|include_once)\s*\(?['"]([^'"]+)['"]\)?/g,
    /\buse\s+([A-Z][\w\\]+(?:\s*{[^}]+})?)/g,
  ];

  for (const r of patterns) {
    let m: RegExpExecArray | null;
    while ((m = r.exec(code))) {
      const val = m[1];
      if (val) out.add(val);
    }
  }
  return out;
}

/**
 * Expands grouped `use` imports into individual fully qualified names.
 * Example:
 *   "App\\Models\\{User, Team}" → ["App\\Models\\User", "App\\Models\\Team"]
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
