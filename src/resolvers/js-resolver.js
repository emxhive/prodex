import fs from "fs";
import path from "path";
import { IMPORT_EXCLUDES, ROOT } from "../constants/config.js";

const debug = process.env.PRODEX_DEBUG === "1";
const log = (...args) => { if (debug) console.log("🪶 [resolver]", ...args); };

// --- Loaders --------------------------------------------------

function loadViteAliases() {
  const files = [
    "vite.config.ts",
    "vite.config.js",
    "vite.config.mts",
    "vite.config.mjs",
    "vite.config.cjs",
  ];
  const map = {};
  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const s = fs.readFileSync(p, "utf8");
    const obj = /resolve\s*:\s*{[\s\S]*?alias\s*:\s*{([\s\S]*?)}/m.exec(s);
    if (!obj) continue;
    const re = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(obj[1]))) {
      const key = m[1];
      const raw = m[2].replace(/^\/+/, "");
      const abs = path.resolve(ROOT, raw);
      map[key] = abs;
    }
  }
  return map;
}

function loadTsconfigAliases() {
  const p = path.join(ROOT, "tsconfig.json");
  if (!fs.existsSync(p)) return {};
  let content = fs.readFileSync(p, "utf8")
    .replace(/("(?:\\.|[^"\\])*")|\/\/.*$|\/\*[\s\S]*?\*\//gm, (_, q) => q || "")
    .replace(/,\s*([}\]])/g, "$1");
  let j;
  try {
    j = JSON.parse(content);
  } catch {
    return {};
  }
  const paths = j.compilerOptions?.paths || {};
  const base = j.compilerOptions?.baseUrl || ".";
  const map = {};
  for (const k in paths) {
    const arr = paths[k];
    if (!Array.isArray(arr) || !arr.length) continue;
    const from = k.replace(/\*$/, "");
    const to = arr[0].replace(/\*$/, "");
    map[from] = path.resolve(ROOT, base, to);
  }
  return map;
}

function loadJsAliases() {
  return { ...loadTsconfigAliases(), ...loadViteAliases() };
}

// --- Resolver Core --------------------------------------------

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

function isImportExcluded(p) {
  return IMPORT_EXCLUDES.some(ex => p.includes(ex));
}

export async function resolveJsImports(filePath, visited = new Set(), depth = 0, maxDepth = 10) {
  if (visited.has(filePath)) return { files: [], visited };
  visited.add(filePath);
  if (isImportExcluded(filePath) || !fs.existsSync(filePath))
    return { files: [], visited };

  const code = fs.readFileSync(filePath, "utf8");
  const ext = path.extname(filePath).toLowerCase();
  if (![".ts", ".tsx", ".d.ts", ".js", ".jsx", ".mjs"].includes(ext))
    return { files: [], visited };

  const aliases = loadJsAliases();
  const patterns = [
    /import\s+[^'"]*['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /export\s+\*\s+from\s+['"]([^'"]+)['"]/g,
  ];

  const matches = new Set();
  for (const r of patterns) {
    let m;
    while ((m = r.exec(code))) matches.add(m[1]);
  }

  const resolved = [];
  for (const imp of matches) {
    if (!imp.startsWith(".") && !imp.startsWith("/") && !imp.startsWith("@")) continue;
    if (isImportExcluded(imp)) continue;

    let importPath;
    if (imp.startsWith("@")) {
      const aliasKey = Object.keys(aliases).find(a => imp.startsWith(a));
      if (aliasKey) {
        const relPart = imp.slice(aliasKey.length).replace(/^\/+/, "");
        importPath = path.join(aliases[aliasKey], relPart);
      } else continue;
    } else importPath = path.resolve(path.dirname(filePath), imp);

    const resolvedPath = tryResolveImport(importPath);
    if (!resolvedPath || isImportExcluded(resolvedPath)) continue;
    resolved.push(resolvedPath);

    if (depth < maxDepth) {
      const sub = await resolveJsImports(resolvedPath, visited, depth + 1, maxDepth);
      resolved.push(...sub.files);
    }
  }

  return { files: [...new Set(resolved)], visited };
}
