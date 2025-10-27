import fs from "fs";
import path from "path";
import micromatch from "micromatch";
import { safeMicromatchScan } from "../core/file-utils.js";

const debug = process.env.PRODEX_DEBUG === "1";
const log = (...a) => {
  if (debug) console.log("🪶 [js-resolver]", ...a);
};

/**
 * Load alias mappings from vite.config.* or tsconfig.json.
 * Local config aliases (cfg.imports.aliases) override these.
 */
function loadProjectAliases(ROOT) {
  const viteFiles = [
    "vite.config.ts",
    "vite.config.js",
    "vite.config.mts",
    "vite.config.mjs",
    "vite.config.cjs"
  ];
  const map = {};

  // --- Vite aliases ---------------------------------------------------------
  for (const f of viteFiles) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const s = fs.readFileSync(p, "utf8");
    const block = /resolve\s*:\s*{[\s\S]*?alias\s*:\s*{([\s\S]*?)}/m.exec(s);
    if (!block) continue;
    const re = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(block[1]))) {
      const key = m[1];
      const raw = m[2].replace(/^\/+/, "");
      map[key] = path.resolve(ROOT, raw);
    }
  }

  // --- TSConfig aliases -----------------------------------------------------
  const ts = path.join(ROOT, "tsconfig.json");
  if (fs.existsSync(ts)) {
    try {
      const content = fs
        .readFileSync(ts, "utf8")
        .replace(/("(?:\\.|[^"\\])*")|\/\/.*$|\/\*[\s\S]*?\*\//gm, (_, q) => q || "")
        .replace(/,\s*([}\]])/g, "$1");
      const j = JSON.parse(content);
      const paths = j.compilerOptions?.paths || {};
      const base = j.compilerOptions?.baseUrl || ".";
      for (const k in paths) {
        const arr = paths[k];
        if (!Array.isArray(arr) || !arr.length) continue;
        const from = k.replace(/\*$/, "");
        const to = arr[0].replace(/\*$/, "");
        map[from] = path.resolve(ROOT, base, to);
      }
    } catch {}
  }

  return map;
}

/**
 * Try to resolve an import path into a real file.
 */
function tryResolveImport(basePath) {
  const ext = path.extname(basePath);
  const tries = [];
  if (ext) tries.push(basePath);
  else {
    for (const x of [".ts", ".tsx", ".d.ts", ".js", ".jsx", ".mjs"])
      tries.push(basePath + x, path.join(basePath, "index" + x));
  }
  for (const t of tries)
    if (fs.existsSync(t) && fs.statSync(t).isFile()) return path.resolve(t);
  return null;
}

/**
 * Core: resolve JS / TS imports recursively.
 * Returns unique project-level expected + resolved import sets.
 */
export async function resolveJsImports(
  filePath,
  cfg,
  visited = new Set(),
  depth = 0,
  maxDepth = 10,
  ctx = {}
) {
  if (depth >= maxDepth) {
    if (debug) console.log(`⚠️  JS resolver depth (${maxDepth}) reached at ${filePath}`);
    return { files: [], visited, stats: { expected: new Set(), resolved: new Set() } };
  }

  const { imports } = cfg;
  const ROOT = process.cwd();

  if (!ctx.aliases)
    ctx.aliases = { ...loadProjectAliases(ROOT), ...imports.aliases };
  const aliases = ctx.aliases;

  const isExcluded = (p) =>
    micromatch.isMatch(p.replaceAll("\\", "/"), imports.excludes || []);
  if (visited.has(filePath))
    return { files: [], visited, stats: { expected: new Set(), resolved: new Set() } };
  visited.add(filePath);

  if (!fs.existsSync(filePath) || isExcluded(filePath))
    return { files: [], visited, stats: { expected: new Set(), resolved: new Set() } };

  const code = fs.readFileSync(filePath, "utf8");
  const ext = path.extname(filePath).toLowerCase();
  if (![".ts", ".tsx", ".d.ts", ".js", ".jsx", ".mjs"].includes(ext))
    return { files: [], visited, stats: { expected: new Set(), resolved: new Set() } };

  const patterns = [
    /import\s+[^'"]*['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /export\s+\*\s+from\s+['"]([^'"]+)['"]/g
  ];

  const matches = new Set();
  for (const r of patterns) {
    let m;
    while ((m = r.exec(code))) matches.add(m[1]);
  }

  const resolved = [];
  const expectedImports = new Set();
  const resolvedImports = new Set();

  for (const imp of matches) {
    if (!imp.startsWith(".") && !imp.startsWith("/") && !imp.startsWith("@")) continue;
    if (isExcluded(imp)) continue;

    expectedImports.add(imp);

    let importPath;
    if (imp.startsWith("@")) {
      const aliasKey = Object.keys(aliases).find((a) => imp.startsWith(a));
      if (aliasKey) {
        const relPart = imp.slice(aliasKey.length).replace(/^\/+/, "");
        importPath = path.join(aliases[aliasKey], relPart);
      } else continue;
    } else {
      importPath = path.resolve(path.dirname(filePath), imp);
    }

    const resolvedPath = tryResolveImport(importPath);
    if (!resolvedPath || isExcluded(resolvedPath)) continue;
    resolved.push(resolvedPath);
    resolvedImports.add(resolvedPath);

    if (depth < maxDepth) {
      const sub = await resolveJsImports(resolvedPath, cfg, visited, depth + 1, maxDepth, ctx);
      resolved.push(...sub.files);
      sub.stats?.expected?.forEach((i) => expectedImports.add(i));
      sub.stats?.resolved?.forEach((i) => resolvedImports.add(i));
    }
  }

  // Always-include patterns (no recursion)
  for (const pattern of imports.includes || []) {
    const scan = safeMicromatchScan(pattern, { cwd: ROOT, absolute: true });
    if (scan?.files) {
      for (const f of scan.files) resolved.push(path.resolve(ROOT, f));
    }
  }

  log("✅ JS resolver completed for", filePath, "→", resolved.length, "files");
  return {
    files: [...new Set(resolved)],
    visited,
    stats: { expected: expectedImports, resolved: resolvedImports }
  };
}
