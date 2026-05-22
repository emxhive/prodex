import type { ProdexFlags } from "../types";

export type FlagName = keyof ProdexFlags | "help" | "version" | "profile" | "write" | "check";

export type FlagSpec = {
	long: FlagName;
	short?: string;
	type: "boolean" | "string" | "number" | "list";
};

export const COMMANDS = ["run", "init", "profiles", "migrate"] as const;

export const FLAGS: FlagSpec[] = [
	{ long: "entry", short: "e", type: "list" },
	{ long: "include", short: "i", type: "list" },
	{ long: "exclude", short: "x", type: "list" },
	{ long: "profile", short: "p", type: "list" },
	{ long: "allProfiles", short: "a", type: "boolean" },
	{ long: "name", short: "n", type: "string" },
	{ long: "format", short: "F", type: "string" },
	{ long: "maxDepth", type: "number" },
	{ long: "maxFiles", type: "number" },
	{ long: "debug", short: "d", type: "boolean" },
	{ long: "write", type: "boolean" },
	{ long: "check", type: "boolean" },
	{ long: "help", short: "h", type: "boolean" },
	{ long: "version", short: "v", type: "boolean" },
];

export const FLAG_ALIASES: Record<string, FlagName> = {
	all: "allProfiles",
	"all-profiles": "allProfiles",
	"max-depth": "maxDepth",
	"max-files": "maxFiles",
};

export const FLAGS_BY_LONG = new Map(FLAGS.map((flag) => [flag.long, flag]));
export const FLAGS_BY_SHORT = new Map(FLAGS.filter((flag) => flag.short).map((flag) => [flag.short!, flag]));
