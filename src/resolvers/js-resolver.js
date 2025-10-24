import fs from "fs";
import path from "path";
import { IMPORT_EXCLUDES, ROOT } from "../constants/config.js";

function loadViteAliases() {
  const fns = [
    "vite.config.ts",
    "vite.config.js",
    "vite.config.mts",
    "vite.config.mjs",
    "vite.config.cjs",
  ];
  const map = {};
  for (const f of fns) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const s = fs.readFileSync(p, "utf8");
    const obj = /alias\s*:\s*{([\s\S]*?)}/m.exec(s);
    if (obj) {
      let m1;
      const re = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
      while ((m1 = re.exec(obj[1]))) map[m1[1]] = m1[2];
    }
  }
  return map;
}

function loadTsconfigAliases() {
  const p = path.join(ROOT, "tsconfig.json");
  if (!fs.existsSync(p)) return {};
  let content = fs.readFileSync(p, "utf8");
  content = content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const j = JSON.parse(content);
  const paths = j.compilerOptions?.paths || {};
  const base = j.compilerOptions?.baseUrl || ".";
  const map = {};
  for (const k in paths) {
    const arr = paths[k];
    if (!Array.isArray(arr) || !arr.length) continue;
    map[k.replace(/\*$/, "")] = path.join(
      ROOT,
      base,
      arr[0].replace(/\*$/, "")
    );
  }
  return map;
}

function loadJsAliases() {
  return { ...loadTsconfigAliases(), ...loadViteAliases() };
}

function tryResolveImport(basePath) {
  const ext = path.extname(basePath);
  const tries = [];
  if (ext) tries.push(basePath);
  else
    for (const x of [".ts", ".tsx", ".d.ts", ".js", ".jsx", ".mjs"])
      tries.push(basePath + x, path.join(basePath, "index" + x));
  for (const t of tries)
    if (fs.existsSync(t) && fs.statSync(t).isFile()) return path.resolve(t);
  return null;
}

function isImportExcluded(p) {
  return IMPORT_EXCLUDES.some((ex) => p.includes(ex));
}

export async function resolveJsImports(
  filePath,
  visited = new Set(),
  depth = 0,
  maxDepth = 10
) {
  const resolved = [];
  if (visited.has(filePath) || isImportExcluded(filePath))
    return { files: [], visited };
  visited.add(filePath);
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
  for (const imp of matches) {
    if (!imp.startsWith(".") && !imp.startsWith("/") && !imp.startsWith("@"))
      continue;
    if (isImportExcluded(imp)) continue;
    let importPath;
    if (imp.startsWith("@")) {
      const aliasKey = Object.keys(aliases).find((a) => imp.startsWith(a));
      if (aliasKey) {
        const relPart = imp.slice(aliasKey.length).replace(/^\/+/, "");
        importPath = path.join(aliases[aliasKey], relPart);
      }
    } else {
      importPath = path.resolve(path.dirname(filePath), imp);
    }
    const resolvedPath = tryResolveImport(importPath);
    if (!resolvedPath || isImportExcluded(resolvedPath)) continue;
    resolved.push(resolvedPath);
    if (depth < maxDepth) {
      const sub = await resolveJsImports(resolvedPath, visited, depth + 1, maxDepth);
      resolved.push(...sub.files);
    }
  }
  return { files: resolved, visited };
}
