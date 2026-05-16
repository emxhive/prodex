import type { ProdexConfig } from "./config.types";

/** Context for JS resolver (aliases precomputed). */
export interface JsResolverCtx {
  kind: "js";
  aliases: Record<string, string>;
}

/** Context for PHP resolver (PSR-4 map, bindings, etc.). */
export interface PhpResolverCtx {
  kind: "php";
  psr4: Record<string, string>;
  nsKeys: string[];
  bindings: Record<string, string>;
}

/** Shared parameter contract for all resolvers */
export interface ResolverParams {
  /** Active runtime configuration for this resolver run */
  cfg: ProdexConfig;

  /** Absolute path of the file being resolved */
  filePath: string;

  /** Set of files already visited (to prevent recursion loops) */
  visited?: Set<string>;

  /** Current recursion depth */
  depth?: number;

  /** Maximum recursion depth allowed */
  maxDepth?: number;

  /** Shared context cache (aliases, bindings, psr4, etc.) */
  ctx?: JsResolverCtx | PhpResolverCtx;
}

/** Standard resolver result shape for both JS and PHP. */
export interface ResolverResult {
  files: string[];
  visited: Set<string>;
  stats: {
    expected: Set<string>;
    resolved: Set<string>;
  };
}
