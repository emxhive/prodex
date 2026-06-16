import type { ProdexFlags } from "../types";

export type FlagName =
	| keyof ProdexFlags
	| "help"
	| "version"
	| "write"
	| "check"
	| "profile"
	| "allProfiles"
	| "maxDepth";

export type FlagSpec = {
	long: FlagName;
	short?: string;
	type: "boolean" | "string" | "number" | "list" | "raw-list";
};

export const COMMANDS = ["pack", "trace", "scope", "git", "init", "migrate", "run", "profiles"] as const;

export const FLAGS: FlagSpec[] = [
	{ long: "entry", short: "e", type: "list" },
	{ long: "target", short: "t", type: "list" },
	{ long: "include", short: "i", type: "list" },
	{ long: "exclude", short: "x", type: "list" },
	{ long: "name", short: "n", type: "string" },
	{ long: "format", short: "F", type: "string" },
	{ long: "depth", short: "d", type: "number" },
	{ long: "maxFiles", type: "number" },
	{ long: "debug", type: "boolean" },
	{ long: "scope", short: "s", type: "list" },
	{ long: "key", short: "k", type: "list" },
	{ long: "all", short: "a", type: "boolean" },
	{ long: "list", type: "boolean" },
	{ long: "dryRun", type: "boolean" },
	{ long: "cmd", type: "raw-list" },
	{ long: "cmdTimeout", type: "number" },
	{ long: "failOnCmdError", type: "boolean" },
	{ long: "write", type: "boolean" },
	{ long: "check", type: "boolean" },
	{ long: "help", short: "h", type: "boolean" },
	{ long: "version", short: "v", type: "boolean" },

	// Git specific flags
	{ long: "changed", type: "boolean" },
	{ long: "staged", type: "boolean" },
	{ long: "unstaged", type: "boolean" },
	{ long: "untracked", type: "boolean" },
	{ long: "includeDiff", type: "boolean" },

	// Deprecated / legacy flags (parsed to return guided errors)
	{ long: "profile", short: "p", type: "list" },
	{ long: "allProfiles", type: "boolean" },
	{ long: "maxDepth", type: "number" },
];

export const FLAG_ALIASES: Record<string, FlagName> = {
	"max-files": "maxFiles",
	"dry-run": "dryRun",
	"all-profiles": "allProfiles",
	"max-depth": "maxDepth",
	"cmd-timeout": "cmdTimeout",
	"fail-on-cmd-error": "failOnCmdError",
	"include-diff": "includeDiff",
};

export const FLAGS_BY_LONG = new Map(FLAGS.map((flag) => [flag.long, flag]));
export const FLAGS_BY_SHORT = new Map(FLAGS.filter((flag) => flag.short).map((flag) => [flag.short!, flag]));
