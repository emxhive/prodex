import fs from "fs";
import path from "path";
import { ROOT, CODE_EXTS, ENTRY_EXCLUDES } from "../constants/config.js";

export function rel(p) {
  return path.relative(ROOT, p).replaceAll("\\", "/");
}

export function read(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

export function normalizeIndent(s) {
  return s
    .replace(/\t/g, "  ")
    .split("\n")
    .map(l => l.replace(/[ \t]+$/, ""))
    .join("\n");
}

export function stripComments(code, ext) {
  if (ext === ".php") {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*#.*$/gm, "");
  }

  let out = "";
  let inStr = false;
  let strChar = "";
  let inBlockComment = false;
  let inLineComment = false;

  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    const next = code[i + 1];

    if (inBlockComment) {
      if (c === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inLineComment) {
      if (c === "\n") {
        inLineComment = false;
        out += c;
      }
      continue;
    }

    if (inStr) {
      if (c === "\\" && next) {
        out += c + next;
        i++;
        continue;
      }
      if (c === strChar) inStr = false;
      out += c;
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      inStr = true;
      strChar = c;
      out += c;
      continue;
    }

    if (c === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    if (c === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }

    out += c;
  }

  return out;
}

export function isEntryExcluded(p) {
  const r = rel(p);
  return ENTRY_EXCLUDES.some(ex => r.startsWith(ex) || r.includes(ex));
}

export function* walk(dir, depth = 0, maxDepth = 2) {
  if (depth > maxDepth) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full, depth + 1, maxDepth);
    else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      const relPath = rel(full);
      if (CODE_EXTS.includes(ext) && !ENTRY_EXCLUDES.some(ex => relPath.startsWith(ex))) {
        yield full;
      }
    }
  }
}

export function sortWithPriority(files, priorityList = []) {
  if (!priorityList.length) return files;
  const prioritized = [];
  const normal = [];

  for (const f of files) {
    const normalized = f.replaceAll("\\", "/").toLowerCase();
    if (priorityList.some(p => normalized.includes(p.toLowerCase()))) prioritized.push(f);
    else normal.push(f);
  }

  return [...new Set([...prioritized, ...normal])];
}
