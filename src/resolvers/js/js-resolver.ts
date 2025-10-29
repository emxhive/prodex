// @ts-nocheck

import fs from "fs/promises";
import path from "path";
import micromatch from "micromatch";
import { extractImports } from "../../core/parsers/extract-imports";
import { loadProjectAliases } from "./alias-loader";
import { BASE_EXTS, DTS_EXT } from "../../constants/config";
import { setDiff } from "../../lib/utils";
import { logger } from "../../lib/logger";



const IMPORTS_CACHE = new Map();
const STAT_CACHE = new Map();

export async function resolveJsImports(
  filePath,
  cfg,
  visited = new Set(),
  depth = 0,
  maxDepth = cfg?.resolve?.depth ?? 8,
  ctx = {}
) {
  if (depth >= maxDepth) return empty(visited);

  const ROOT = cfg.root;
  const resolveCfg = cfg.resolve ?? {};

  // Single exclude list, applied to RAW SPECIFIERS only.
  const excludes = resolveCfg.excludes ?? [];
  const isExcluded = micromatch.matcher(excludes);

  if (visited.has(filePath)) return empty(visited);
  visited.add(filePath);

  const ext = path.extname(filePath).toLowerCase();
  const isDts = ext === DTS_EXT;

  if (!BASE_EXTS.includes(ext) && !isDts) return empty(visited);

  let code;
  try {
    code = await fs.readFile(filePath, "utf8");
  } catch {
    return empty(visited);
  }

  if (!ctx.aliases) {
    ctx.aliases = { ...loadProjectAliases(ROOT), ...(resolveCfg.aliases || {}) };
  }
  const aliases = ctx.aliases;

  const matches = await getImportsCached(filePath, code);
  if (!matches.size) return empty(visited);

  const filesOut = [];
  const expected = new Set();
  const resolvedSet = new Set();

  for (const imp of matches) {
    // Only consider relative, absolute, or known-alias specifiers
    if (!imp.startsWith(".") && !imp.startsWith("/") && !startsWithAnyAlias(imp, aliases)) {
      continue;
    }

    // Apply single exclude matcher to the RAW specifier
    if (isExcluded(imp)) continue;

    // Always count valid, non-excluded specifiers as "expected"
    expected.add(imp);

    const basePath = resolveBasePath(filePath, imp, aliases);
    if (!basePath) continue;

    const resolvedPath = await tryResolveImport(basePath, ROOT);
    if (!resolvedPath) continue;

    filesOut.push(resolvedPath);
    resolvedSet.add(imp);

    // Never recurse into `.d.ts`
    if (resolvedPath.toLowerCase().endsWith(DTS_EXT)) {
      continue;
      logger.debug("HERE HERE")
    }

    const sub = await resolveJsImports(
      resolvedPath,
      cfg,
      visited,
      depth + 1,
      maxDepth,
      ctx
    );

    if (sub.files.length) filesOut.push(...sub.files);
    for (const s of sub.stats.expected) expected.add(s);
    for (const r of sub.stats.resolved) resolvedSet.add(r);
  }

  const uniqueFiles = [...new Set(filesOut)];

  //Stat Log
  const expCount = expected.size;
  const resCount = resolvedSet.size;
  const diff = setDiff( expected, resolvedSet);

  logger.debug(`🪶 [js-resolver] ${filePath} → expected: ${expCount}, resolved: ${resCount}`);
  logger.debug([...diff], "🔴THE diff");


  return { files: uniqueFiles, visited, stats: { expected, resolved: resolvedSet } };

}

// ---------- helpers ----------

function startsWithAnyAlias(imp, aliases) {
  return Object.keys(aliases).some(
    (a) => imp === a || imp.startsWith(a + "/")
  );
}

function resolveBasePath(fromFile, specifier, aliases) {
  if (specifier.startsWith("@")) {
    const key = Object.keys(aliases)
      .filter((a) => specifier === a || specifier.startsWith(a + "/"))
      .sort((a, b) => b.length - a.length)[0];

    if (!key) return null;
    const relPart = specifier.slice(key.length).replace(/^\/+/, "");
    return path.resolve(aliases[key], relPart);
  }

  if (specifier.startsWith(".")) {
    return path.resolve(path.dirname(fromFile), specifier);
  }

  if (specifier.startsWith("/")) {
    return path.resolve(specifier);
  }

  return null;
}

async function tryResolveImport(basePath, ROOT) {
  const candidates = [];

  if (path.extname(basePath)) {
    candidates.push(basePath);
  } else {
    for (const ext of [...BASE_EXTS, DTS_EXT]) {
      candidates.push(basePath + ext);
      candidates.push(path.join(basePath, "index" + ext));
    }
  }

  for (const c of candidates) {
    const abs = path.resolve(c);
    const st = await safeStat(abs);
    if (st && st.isFile()) return abs;
  }

  return null;
}

async function safeStat(p) {
  if (STAT_CACHE.has(p)) return STAT_CACHE.get(p);
  try {
    const st = await fs.stat(p);
    STAT_CACHE.set(p, st);
    return st;
  } catch {
    STAT_CACHE.set(p, null);
    return null;
  }
}

async function getImportsCached(filePath, code) {
  if (IMPORTS_CACHE.has(filePath)) return IMPORTS_CACHE.get(filePath);
  const set = await extractImports(filePath, code);
  IMPORTS_CACHE.set(filePath, set);
  return set;
}

function empty(visited) {
  return { files: [], visited, stats: { expected: new Set(), resolved: new Set() } };
}


