// @ts-nocheck

import fs from "fs";
import path from "path";

export function resolvePsr4(ROOT) {
  const composer = path.join(ROOT, "composer.json");
  if (!fs.existsSync(composer)) return {};

  try {
    const data = JSON.parse(fs.readFileSync(composer, "utf8"));
    const src = data.autoload?.["psr-4"] || {};
    const map = {};
    for (const ns in src) {
      map[ns.replace(/\\+$/, "")] = path.resolve(ROOT, src[ns]);
    }
    return map;
  } catch {
    return {};
  }
}
