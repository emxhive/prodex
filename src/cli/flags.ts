/**
 * 🧩 Prodex Flag Definitions (v3)
 * Metadata used by the CLI parser for validation, casting, and help output.
 */
export type FlagType = "boolean" | "string" | "number" | "list";

export enum FlagKey {
  Txt = "txt",
  Ci = "ci",
  Debug = "debug",
  Verbose = "verbose",
  Name = "name",
  Limit = "limit",
  Inc = "inc",
  Exc = "exc",
  Help = "help"
}

export const PRODEX_FLAGS: Record<
  FlagKey,
  {
    short?: string;
    type: FlagType;
    description: string;
    pathish?: boolean;
  }
> = {
  [FlagKey.Txt]: { short: "t", type: "boolean", description: "Output as .txt instead of .md." },
  [FlagKey.Ci]: { short: "c", type: "boolean", description: "Headless/no-UI mode." },
  [FlagKey.Debug]: { short: "d", type: "boolean", description: "Enable debug logs." },
  [FlagKey.Verbose]: { short: "v", type: "boolean", description: "Enable verbose logs." },
  [FlagKey.Name]: { short: "n", type: "string", description: "Custom output filename." },
  [FlagKey.Limit]: { short: "l", type: "number", description: "Override traversal limit." },
  [FlagKey.Inc]: {
    type: "list",
    description: "Comma-separated include globs.",
    pathish: true
  },
  [FlagKey.Exc]: {
    type: "list",
    description: "Comma-separated exclude globs.",
    pathish: true
  },
  [FlagKey.Help]: { short: "h", type: "boolean", description: "Show CLI help and exit." }
};

/** Reverse lookup for short aliases. */
export const FLAG_SHORT_MAP: Record<string, FlagKey> = Object.entries(PRODEX_FLAGS).reduce(
  (acc, [key, meta]) => {
    if (meta.short) acc[meta.short] = key as FlagKey;
    return acc;
  },
  {} as Record<string, FlagKey>
);

/** CLI usage text (for --help). */
export const CLI_USAGE = `
Usage: prodex [entries...] [-tcdv]
       [--txt] [--ci] [--debug] [--verbose]
       [--name=<string>|-n=<string>]
       [--limit=<int>|-l=<int>]
       [--inc=<globs>] [--exc=<globs>]
       [--help|-h]
`;
