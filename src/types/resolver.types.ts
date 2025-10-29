/** Context for JS resolver (aliases precomputed). */
export interface JsResolverCtx {
  aliases: Record<string, string>;
}

/** Context for PHP resolver (PSR-4 map, bindings, etc.). */
export interface PhpResolverCtx {
  psr4: Record<string, string>;
  nsKeys: string[];
  bindings: Record<string, string>;
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
