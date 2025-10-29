/** Shared stats type across resolvers and chain results. */
export interface Stats {
  expected: Set<string>;
  resolved: Set<string>;
}

/** Followed dependency chain result. */
export interface ChainResult {
  files: string[];
  stats: Stats;
}

/** Options accepted by runCombine (keep lean). */
export interface CombineOptions {
  entries?: string[];
}
