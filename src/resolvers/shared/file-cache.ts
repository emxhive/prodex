// @ts-nocheck

import fs from "fs";
import path from "path";

const CACHE = new Map();

export function tryResolvePhpFile(imp, fromFile, psr4) {
  const key = `php:${imp}:${fromFile}`;
  if (CACHE.has(key)) return CACHE.get(key);

  const nsKey = Object.keys(psr4).find(k => imp.startsWith(k));
  if (!nsKey) {
    CACHE.set(key, null);
    return null;
  }

  const rel = imp.slice(nsKey.length).replace(/\\/g, "/");

  const tries = [
    path.join(psr4[nsKey], rel),
    path.join(psr4[nsKey], rel + ".php"),
    path.join(psr4[nsKey], rel, "index.php")
  ];

  const resolved = tries.find(p => fs.existsSync(p) && fs.statSync(p).isFile());

  CACHE.set(key, resolved ? path.resolve(resolved) : null);
  return CACHE.get(key);
}
