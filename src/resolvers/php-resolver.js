import fs from "fs";
import path from "path";
import micromatch from "micromatch";
import { loadLaravelBindings } from "./php-bindings.js";
import { safeMicromatchScan } from "../core/file-utils.js";

const debug = process.env.PRODEX_DEBUG === "1";
const log = (...a) => { if (debug) console.log("🪶 [php-resolver]", ...a); };

/**
 * Load PSR-4 namespaces from composer.json
 */
function loadComposerNamespaces(ROOT) {
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

/**
 * Try to resolve a PHP include/namespace to a file.
 */
function tryResolvePhpImport(basePath) {
  if (!basePath || typeof basePath !== "string") return null;
  const tries = [basePath, basePath + ".php", path.join(basePath, "index.php")];
  for (const t of tries)
    if (fs.existsSync(t) && fs.statSync(t).isFile()) return path.resolve(t);
  return null;
}

/**
 * Core PHP resolver — PSR-4 + Laravel bindings + glob excludes.
 * @param {string} filePath
 * @param {object} cfg - full prodex config
 * @param {Set<string>} visited
 * @param {number} depth
 * @param {number} maxDepth
 */
export async function resolvePhpImports(filePath, cfg, visited = new Set(), depth = 0, maxDepth = 10, ctx = {}) {
  if (depth >= maxDepth) {
    if (debug) console.log(`⚠️  PHP resolver depth (${maxDepth}) reached at ${filePath}`);
    return { files: [], visited, stats: { found: 0, resolved: 0 } };
  }

  const { imports } = cfg;
  const ROOT = process.cwd();

  if (!ctx.namespaces) ctx.namespaces = loadComposerNamespaces(ROOT);
  if (!ctx.bindings) ctx.bindings = loadLaravelBindings();

  const isExcluded = p => micromatch.isMatch(p.replaceAll("\\", "/"), imports.excludes || []);
  if (visited.has(filePath)) return { files: [], visited, stats: { found: 0, resolved: 0 } };
  visited.add(filePath);

  if (!fs.existsSync(filePath) || isExcluded(filePath))
    return { files: [], visited, stats: { found: 0, resolved: 0 } };

  const code = fs.readFileSync(filePath, "utf8");
  const { namespaces, bindings } = ctx;
  const resolved = [];

  const patterns = [
    /\b(?:require|include|require_once|include_once)\s*\(?['"]([^'"]+)['"]\)?/g,
    /\buse\s+([A-Z][\w\\]+(?:\s*{[^}]+})?)/g
  ];

  const rawMatches = new Set();
  for (const r of patterns) {
    let m;
    while ((m = r.exec(code))) rawMatches.add(m[1]);
  }

  const matches = new Set();
  for (const imp of rawMatches) {
    const groupMatch = imp.match(/^(.+?)\s*{([^}]+)}/);
    if (groupMatch) {
      const base = groupMatch[1].trim().replace(/\\+$/, "");
      groupMatch[2].split(",").map(x => x.trim()).filter(Boolean).forEach(p => matches.add(`${base}\\${p}`));
    } else matches.add(imp.trim());
  }

  let totalFound = 0, totalResolved = 0;

  for (const imp0 of matches) {
    totalFound++;
    let imp = bindings[imp0] || imp0;
    if (bindings[imp0]) log("🔗 Interface resolved via binding:", imp0, "→", imp);

    let importPath;
    if (imp.includes("\\")) {
      const nsKey = Object.keys(namespaces).find(k => imp.startsWith(k));
      if (!nsKey) continue;
      const relPart = imp.slice(nsKey.length).replace(/\\/g, "/");
      importPath = path.join(namespaces[nsKey], `${relPart}.php`);
    } else {
      importPath = path.resolve(path.dirname(filePath), imp);
    }

    if (!importPath || isExcluded(importPath)) continue;
    const resolvedPath = tryResolvePhpImport(importPath);
    if (!resolvedPath || isExcluded(resolvedPath)) continue;
    resolved.push(resolvedPath);
    totalResolved++;

    if (depth < maxDepth) {
      const sub = await resolvePhpImports(resolvedPath, cfg, visited, depth + 1, maxDepth, ctx);
      resolved.push(...sub.files);
      totalFound += sub.stats?.found || 0;
      totalResolved += sub.stats?.resolved || 0;
    }
  }

  for (const pattern of imports.includes || []) {
    const scan = safeMicromatchScan(pattern, { cwd: ROOT, absolute: true });
    if (scan?.files) scan.files.forEach(f => resolved.push(path.resolve(ROOT, f)));
  }

  log("✅ PHP resolver completed for", filePath, "→", resolved.length, "files");
  return {
    files: [...new Set(resolved)],
    visited,
    stats: { found: totalFound, resolved: totalResolved }
  };
}
