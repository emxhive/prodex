export const ROOT = process.cwd();
export const CODE_EXTS = [".js", ".mjs", ".ts", ".tsx", ".d.ts", ".php"];

import { resolveJsImports } from "../resolvers/js-resolver.js";
import { resolvePhpImports } from "../resolvers/php-resolver.js";

export const RESOLVERS = {
  ".php": resolvePhpImports,
  ".ts": resolveJsImports,
  ".tsx": resolveJsImports,
  ".d.ts": resolveJsImports,
  ".js": resolveJsImports
};
