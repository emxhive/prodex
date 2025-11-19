import type { ProdexConfig } from "../types";

export type FlagType = "boolean" | "string" | "number" | "list";
export type FlagKey = keyof typeof FLAG_MAP;

export const FLAG_MAP = {
	txt: {
		short: "t",
		type: "boolean",
		description: "Output as .txt instead of .md.",
		apply: (cfg: ProdexConfig, v: boolean) => (cfg.output.format = v ? "txt" : "md"),
	},
	name: {
		short: "n",
		type: "string",
		description: "Custom output filename (without extension).",
		apply: (cfg: ProdexConfig, v: string) => (cfg.name = v),
	},
	limit: {
		short: "l",
		type: "number",
		description: "Override traversal limit.",
		apply: (cfg: ProdexConfig, v: number) => (cfg.resolve.limit = v),
	},
	include: {
		short: "i",
		type: "list",
		description: "Comma-separated include globs.",
		apply: (cfg: ProdexConfig, v: string[]) => (cfg.resolve.include = v),
	},
	exclude: {
		short: "x",
		type: "list",
		description: "Comma-separated exclude globs.",
		apply: (cfg: ProdexConfig, v: string[]) => (cfg.resolve.exclude = v),
	},
	files: {
		short: "f",
		type: "list",
		description: "Entry files (comma-separated).",
		apply: (cfg: ProdexConfig, v: string[]) => (cfg.entry.files = v),
	},
	ci: {
		short: "c",
		type: "boolean",
		description: "Headless (non-interactive) mode.",
		apply: () => {},
	},
	debug: {
		short: "d",
		type: "boolean",
		description: "Enable debug logs.",
		apply: () => {},
	},

	shortcut: {
	short: "a",
	type: "string",
	description: "Apply a config shortcut by name.",
	apply: () => {},
},
	help: {
		short: "h",
		type: "boolean",
		description: "Show CLI help and exit.",
		apply: () => {},
	},
} as const;

// Reverse lookup for short aliases
export const FLAG_SHORT_MAP = Object.entries(FLAG_MAP).reduce((acc, [k, v]) => {
	//@ts-ignore
	if (v.short) acc[v.short] = k;
	return acc;
}, {} as Record<string, FlagKey>);

export const CLI_USAGE = `
Usage: prodex [options]

${Object.entries(FLAG_MAP)
	.map(([k, v]) => `  --${k}${v.short ? ` | -${v.short}` : ""}\t${v.description}`)
	.join("\n")}
`;
