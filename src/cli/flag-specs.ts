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

export const COMMANDS = ["pack", "trace", "scope", "git", "grep", "init", "migrate", "run", "profiles"] as const;

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
	{ long: "commit", type: "string" },
	{ long: "range", type: "string" },
	{ long: "against", type: "string" },


	// Deprecated / legacy flags (parsed to return guided errors)
	{ long: "profile", short: "p", type: "list" },
	{ long: "allProfiles", type: "boolean" },
	{ long: "maxDepth", type: "number" },
];

export const GREP_FLAGS: FlagSpec[] = [
	{ long: "query", short: "q", type: "string" },
	{ long: "any", type: "list" },
	{ long: "grepAll", type: "list" },
	{ long: "regex", short: "r", type: "string" },
	{ long: "not", type: "list" },
	{ long: "within", type: "list" },
	{ long: "skip", type: "list" },

	{ long: "name", short: "n", type: "string" },
	{ long: "format", short: "F", type: "string" },
	{ long: "dryRun", type: "boolean" },
	{ long: "include", short: "i", type: "list" },
	{ long: "exclude", short: "x", type: "list" },
	{ long: "cmd", type: "raw-list" },
	{ long: "cmdTimeout", type: "number" },
	{ long: "failOnCmdError", type: "boolean" },
	{ long: "maxFiles", type: "number" },
	{ long: "help", short: "h", type: "boolean" },
	{ long: "version", short: "v", type: "boolean" },
	{ long: "debug", type: "boolean" },
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

export const GREP_FLAG_ALIASES: Record<string, FlagName> = {
	...FLAG_ALIASES,
	"all": "grepAll",
};

export const FLAGS_BY_LONG = new Map(FLAGS.map((flag) => [flag.long, flag]));
export const FLAGS_BY_SHORT = new Map(FLAGS.filter((flag) => flag.short).map((flag) => [flag.short!, flag]));

export const GREP_FLAGS_BY_LONG = new Map(GREP_FLAGS.map((flag) => [flag.long, flag]));
export const GREP_FLAGS_BY_SHORT = new Map(GREP_FLAGS.filter((flag) => flag.short).map((flag) => [flag.short!, flag]));
