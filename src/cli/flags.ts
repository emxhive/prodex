/**
 * 🧩 Prodex Flag Definitions (v3)
 * Metadata used by the CLI parser for validation, casting, and help output.
 */
export type FlagType = "boolean" | "string" | "number" | "list";

export enum FlagKey {
	Txt = "txt",
	Ci = "ci",
	Debug = "debug",
	Name = "name",
	Limit = "limit",
	Inc = "include",
	Exc = "exclude",
	Help = "help",
	Files = "files",
}

type Spec = {
	short?: string;
	type: FlagType;
	description: string;
};
export const PRODEX_FLAGS: Record<FlagKey, Spec> = {
	[FlagKey.Files]: { short: "f", type: "list", description: "Comma-separated entry files." },
	[FlagKey.Txt]: { short: "t", type: "boolean", description: "Output as .txt instead of .md." },
	[FlagKey.Ci]: { short: "c", type: "boolean", description: "Headless/no-UI mode." },
	[FlagKey.Debug]: { short: "d", type: "boolean", description: "Enable debug logs." },
	[FlagKey.Name]: { short: "n", type: "string", description: "Custom output filename." },
	[FlagKey.Limit]: { short: "l", type: "number", description: "Override traversal limit." },
	[FlagKey.Inc]: { type: "list", short: "i", description: "Comma-separated include globs." },
	[FlagKey.Exc]: { type: "list", short: "x", description: "Comma-separated exclude globs." },
	[FlagKey.Help]: { short: "h", type: "boolean", description: "Show CLI help and exit." },
};

/** Reverse lookup for short aliases. */
export const FLAG_SHORT_MAP: Record<string, FlagKey> = Object.entries(PRODEX_FLAGS).reduce((acc, [key, meta]) => {
	if (meta.short) acc[meta.short] = key as FlagKey;
	return acc;
}, {} as Record<string, FlagKey>);


export const CLI_USAGE = `
Usage: prodex [-fcdv]
       [--files=<globs>|-f=<globs>]
       [--include=<globs>|-i=<globs>]
       [--exclude=<globs>|-x=<globs>]
       [--txt|-t] [--ci|-c] [--debug|-d] [--version|-v]
       [--name=<string>|-n=<string>]
       [--limit=<int>|-l=<int>]
       [--help|-h]
`;
