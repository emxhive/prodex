import fs from "fs";
import path from "path";
import { ROOT } from "../constants/config.js";
import { loadLaravelBindings } from "./php-bindings.js";

const debug = process.env.PRODEX_DEBUG === "1";
const log = (...args) => { if (debug) console.log("🪶 [php-resolver]", ...args); };

// --- Load Composer PSR-4 Namespaces ----------------------------------------

function loadComposerNamespaces() {
  const composerPath = path.join(ROOT, "composer.json");
  if (!fs.existsSync(composerPath)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(composerPath, "utf8"));
    const psr4 = data.autoload?.["psr-4"] || {};
    const map = {};
    for (const ns in psr4)
      map[ns.replace(/\\+$/, "")] = path.resolve(ROOT, psr4[ns]);
    return map;
  } catch {
    return {};
  }
}

// --- File resolver ---------------------------------------------------------

function tryResolvePhpImport(basePath) {
  if (!basePath || typeof basePath !== "string") return null;
  const tries = [basePath, basePath + ".php", path.join(basePath, "index.php")];
  for (const t of tries)
    if (fs.existsSync(t) && fs.statSync(t).isFile()) return path.resolve(t);
  return null;
}

// --- Main resolver ---------------------------------------------------------

export async function resolvePhpImports(
  filePath,
  visited = new Set(),
  depth = 0,
  maxDepth = 10
) {
  if (visited.has(filePath)) return { files: [], visited };
  visited.add(filePath);
  if (!fs.existsSync(filePath)) return { files: [], visited };

  const code = fs.readFileSync(filePath, "utf8");

  // find include/require + grouped and single use statements
  const patterns = [
    /\b(?:require|include|require_once|include_once)\s*\(?['"]([^'"]+)['"]\)?/g,
    /\buse\s+([A-Z][\w\\]+(?:\s*{[^}]+})?)/g,
  ];

  const rawMatches = new Set();
  for (const r of patterns) {
    let m;
    while ((m = r.exec(code))) rawMatches.add(m[1]);
  }

  // Expand grouped uses
  const matches = new Set();
  for (const imp of rawMatches) {
    const groupMatch = imp.match(/^(.+?)\s*{([^}]+)}/);
    if (groupMatch) {
      const base = groupMatch[1].trim().replace(/\\+$/, "");
      const parts = groupMatch[2]
        .split(",")
        .map(x => x.trim())
        .filter(Boolean);
      for (const p of parts) matches.add(`${base}\${p}`);
    } else {
      matches.add(imp.trim());
    }
  }

  const namespaces = loadComposerNamespaces();
  const bindings = loadLaravelBindings();
  const resolved = [];

  for (const imp0 of matches) {
    let imp = imp0;

    // Interface → Implementation mapping via Service Providers
    if (bindings[imp]) {
      imp = bindings[imp];
      log("🔗 Interface resolved via AppServiceProvider:", imp0, "→", imp);
    }

    let importPath;

    // PSR-4 namespace resolution
    if (imp.includes("\\")) {
      const nsKey = Object.keys(namespaces).find(k => imp.startsWith(k));
      if (!nsKey) continue; // skip vendor namespaces
      const relPart = imp.slice(nsKey.length).replace(/\\/g, "/");
      importPath = path.join(namespaces[nsKey], `${relPart}.php`);
    } else {
      importPath = path.resolve(path.dirname(filePath), imp);
    }

    if (!importPath || typeof importPath !== "string") continue;
    const resolvedPath = tryResolvePhpImport(importPath);
    if (!resolvedPath) continue;
    resolved.push(resolvedPath);

    if (depth < maxDepth) {
      const sub = await resolvePhpImports(resolvedPath, visited, depth + 1, maxDepth);
      resolved.push(...sub.files);
    }
  }

  return { files: [...new Set(resolved)], visited };
}
