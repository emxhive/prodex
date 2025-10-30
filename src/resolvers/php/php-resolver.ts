// @ts-nocheck

import fs from "fs";
import path from "path";
import { loadLaravelBindings } from "./bindings";
import { resolvePsr4 } from "./psr4";
import { extractPhpImports } from "./patterns";
import { logger } from "../../lib/logger";
import { newStats, mergeStats, emptyStats } from "../shared/stats";
import { tryResolvePhpFile } from "../shared/file-cache";
import { isExcluded } from "../shared/excludes";


export async function resolvePhpImports(
  filePath,
  cfg,
  visited = new Set(),
  depth = 0,
  maxDepth = cfg?.resolve?.depth ?? 10,
  ctx = {}
) {
  if (depth >= maxDepth) return empty(visited);

  const stats = newStats();
  const filesOut = [];

  const ROOT = cfg.root || process.cwd();

  if (!ctx.psr4) ctx.psr4 = resolvePsr4(ROOT);
  if (!ctx.nsKeys) ctx.nsKeys = Object.keys(ctx.psr4).sort((a, b) => b.length - a.length);
  if (!ctx.bindings) ctx.bindings = loadLaravelBindings();

  if (visited.has(filePath)) return empty(visited);
  visited.add(filePath);

  if (!fs.existsSync(filePath)) return empty(visited);

  const code = fs.readFileSync(filePath, "utf8");
  const exclude = cfg.imports?.exclude ?? [];

  const raw = extractPhpImports(code);
  const imports = expandGroupedUses(raw);

  for (const imp0 of imports) {
    let imp = imp0;

    if (ctx.bindings[imp]) {
      log("🔗 Bound:", imp0, "→", ctx.bindings[imp]);
      imp = ctx.bindings[imp];
    }

    if (!startsWithAny(imp, ctx.nsKeys)) continue;
    if (isExcluded(imp, exclude)) continue;

    stats.expected.add(imp);

    const resolvedPath = tryResolvePhpFile(imp, filePath, ctx.psr4);
    if (!resolvedPath) continue;

    stats.resolved.add(imp);
    filesOut.push(resolvedPath);

    const sub = await resolvePhpImports(
      resolvedPath,
      cfg,
      visited,
      depth + 1,
      maxDepth,
      ctx
    );

    filesOut.push(...sub.files);
    mergeStats(stats, sub.stats);
  }

  log("✅ PHP resolver:", filePath, "→", filesOut.length);

  return {
    files: [...new Set(filesOut)],
    visited,
    stats
  };
}

// ---------- Local helpers (resolver-scoped only) ----------

function startsWithAny(imp, nsKeys) {
  return nsKeys.some(k => imp.startsWith(k));
}

function empty(visited) {
  return { files: [], visited, stats: emptyStats() };
}

const log = (...a) => logger.debug("[php-resolver]", ...a);

function expandGroupedUses(raw) {
  const out = new Set();
  for (const imp of raw) {
    const g = imp.match(/^(.+?)\s*{([^}]+)}/);
    if (g) {
      const base = g[1].trim().replace(/\\+$/, "");
      g[2]
        .split(",")
        .map(x => x.trim())
        .forEach(p => out.add(`${base}\\${p}`));
    } else {
      out.add(imp.trim());
    }
  }
  return out;
}

