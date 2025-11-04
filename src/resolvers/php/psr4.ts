import fs from "fs";
import path from "path";

/** Cache PSR-4 maps per project root */
const CACHE = new Map<string, Record<string, string>>();

/**
 * Builds a PSR-4 namespace → directory map from composer.json.
 * Returns absolute paths in the map values.
 */
export function resolvePsr4(root: string): Record<string, string> {
  if (CACHE.has(root)) return CACHE.get(root)!;

  const composer = path.join(root, "composer.json");
  if (!fs.existsSync(composer)) {
    CACHE.set(root, {});
    return {};
  }

  try {
    const data = JSON.parse(fs.readFileSync(composer, "utf8")) as {
      autoload?: { ["psr-4"]?: Record<string, string> };
    };

    const src = data.autoload?.["psr-4"] || {};
    const map: Record<string, string> = {};

    for (const ns in src) {
      const cleanNs = ns.replace(/\\+$/, "");
      map[cleanNs] = path.resolve(root, src[ns]);
    }

    CACHE.set(root, map);
    return map;
  } catch {
    CACHE.set(root, {});
    return {};
  }
}
