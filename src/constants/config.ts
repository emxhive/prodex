export const ROOT = process.cwd();
export const CODE_EXTS = [".js", ".mjs", ".ts", ".tsx", ".d.ts", ".php"];

import { resolveJsImports } from "../resolvers/js/js-resolver";
import { resolvePhpImports } from "../resolvers/php/php-resolver";

export const RESOLVERS = {
  ".php": resolvePhpImports,
  ".ts": resolveJsImports,
  ".tsx": resolveJsImports,
  ".d.ts": resolveJsImports,
  ".js": resolveJsImports
};


export const GLOBAL_IGNORE = ["**/node_modules/**", "**/vendor/**", "**/dist/**"];
export const BASE_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".types"];
export const DTS_EXT = ".d.ts";

