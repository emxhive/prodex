import fs from "fs";
import path from "path";
import micromatch from "micromatch";

/**
 * Get a root-relative version of a path.
 */
export function rel(p, root = process.cwd()) {
  return path.relative(root, p).replaceAll("\\", "/");
}

/**
 * Safe text read.
 */
export function read(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

/**
 * Check if a path/file matches any of the provided glob patterns.
 */
export function isExcluded(p, patterns, root = process.cwd()) {
  if (!patterns?.length) return false;
  const relPath = rel(p, root);
  return micromatch.isMatch(relPath, patterns);
}

/**
 * Recursive walker that respects glob excludes.
 * Returns all files under the given directory tree.
 */
export function* walk(dir, cfg, depth = 0) {
  const { scanDepth, entry } = cfg;
  const root = process.cwd();
  if (depth > scanDepth) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);

    if (e.isDirectory()) {
      // Skip excluded directories entirely
      const relPath = rel(full, root);
      if (isExcluded(relPath, entry.excludes)) continue;
      yield* walk(full, cfg, depth + 1);
      continue;
    }

    if (e.isFile()) {
      const relPath = rel(full, root);
      if (isExcluded(relPath, entry.excludes)) continue;
      yield full;
    }
  }
}

/**
 * Sorts files so that priority items appear first.
 */
export function sortWithPriority(files, priorityList = []) {
  if (!priorityList.length) return files;
  const prioritized = [];
  const normal = [];

  for (const f of files) {
    const normalized = f.replaceAll("\\", "/").toLowerCase();
    if (priorityList.some(p => micromatch.isMatch(normalized, p.toLowerCase())))
      prioritized.push(f);
    else normal.push(f);
  }

  return [...new Set([...prioritized, ...normal])];
}
