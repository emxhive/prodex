import fs from "fs";
import path from "path";
import micromatch from "micromatch";

/**
 * Safe micromatch.scan wrapper (compatible with micromatch v4 & v5)
 */
export function safeMicromatchScan(pattern, opts = {}) {
  const scanFn = micromatch.scan;
  if (typeof scanFn === "function") return scanFn(pattern, opts);

  // --- fallback for micromatch v4 ---
  const cwd = opts.cwd || process.cwd();
  const abs = !!opts.absolute;
  const allFiles = listAllFiles(cwd);
  const matched = micromatch.match(allFiles, pattern, { dot: true });
  return { files: abs ? matched.map(f => path.resolve(cwd, f)) : matched };
}

/**
 * Recursively list all files in a directory.
 * Used only for fallback (so performance isn’t critical).
 */
function listAllFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listAllFiles(full));
    else out.push(full);
  }
  return out;
}

export function generateOutputName(entries) {
  const names = entries.map(f => path.basename(f, path.extname(f)));
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}-${names[1]}`;
  if (names.length > 2) return `${names[0]}-and-${names.length - 1}more`;
  return "unknown";
}

export function resolveOutDirPath(outDir, base, asTxt = false) {
  const ext = asTxt ? "txt" : "md";
  return path.join(outDir, `${base}-combined.${ext}`);
}
