import type { FlagName } from "./flag-specs";

export interface HelpFlagSpec {
	long: FlagName;
	description: string;
	hint?: string;
}

export const PUBLIC_FLAGS = {
	entry: { long: "entry", description: "Entry file/glob. Repeatable and comma-aware.", hint: "<glob>" },
	target: { long: "target", description: "Target file/module to resolve and trace from. Repeatable and comma-aware.", hint: "<target>" },
	include: { long: "include", description: "Extra file/glob to append. Repeatable and comma-aware.", hint: "<glob>" },
	exclude: { long: "exclude", description: "File/glob to skip. Repeatable and comma-aware.", hint: "<glob>" },
	scope: { long: "scope", description: "Merge a configured scope's files.", hint: "<key>" },
	name: { long: "name", description: "Output basename for this pack.", hint: "<name>" },
	format: { long: "format", description: "Output format.", hint: "<md|txt>" },
	depth: { long: "depth", description: "Maximum dependency traversal depth.", hint: "<number>" },
	maxFiles: { long: "maxFiles", description: "Maximum traced file count.", hint: "<number>" },
	dryRun: { long: "dryRun", description: "Perform a dry-run without writing output files.", hint: "" },
	cmd: { long: "cmd", description: "Run command sequentially for evidence capture. Repeatable.", hint: "<command>" },
	cmdTimeout: { long: "cmdTimeout", description: "Command execution timeout (default: 180).", hint: "<seconds>" },
	failOnCmdError: { long: "failOnCmdError", description: "Enforce nonzero exit if commands fail.", hint: "" },
	key: { long: "key", description: "Scope key to execute. Repeatable and comma-aware.", hint: "<key>" },
	all: { long: "all", description: "Run all configured scopes.", hint: "" },
	list: { long: "list", description: "List configured scope keys.", hint: "" },
	write: { long: "write", description: "Back up and update prodex.json.", hint: "" },
	check: { long: "check", description: "Exit nonzero if migration is required.", hint: "" },
	help: { long: "help", description: "Show help.", hint: "" },
	version: { long: "version", description: "Show version.", hint: "" },

	// Git specific flags
	changed: { long: "changed", description: "Include staged, unstaged, and untracked changes (default).", hint: "" },
	staged: { long: "staged", description: "Include staged changes.", hint: "" },
	unstaged: { long: "unstaged", description: "Include unstaged changes.", hint: "" },
	untracked: { long: "untracked", description: "Include untracked files.", hint: "" },
	includeDiff: { long: "includeDiff", description: "Include full git diff output in generic sections.", hint: "" },
	commit: { long: "commit", description: "Snapshot files changed by a single commit.", hint: "<rev>" },
	range: { long: "range", description: "Snapshot files changed between two commits (base..head or base...head).", hint: "<spec>" },
	against: { long: "against", description: "Compare merge-base of <base> and HEAD against HEAD.", hint: "<base>" },


	// Grep specific flags
	query: { long: "query", description: "fixed-string search", hint: "<text>" },
	any: { long: "any", description: "OR fixed-string search", hint: "<list>" },
	grepAll: { long: "grepAll", description: "AND fixed-string search", hint: "<list>" },
	regex: { long: "regex", description: "regex search", hint: "<pattern>" },
	not: { long: "not", description: "fixed-string negative file filter", hint: "<list>" },
	within: { long: "within", description: "search only inside these paths/globs", hint: "<list>" },
	skip: { long: "skip", description: "do not search inside these paths/globs", hint: "<list>" },
} as const satisfies Record<string, HelpFlagSpec>;

export type PublicHelpFlagName = keyof typeof PUBLIC_FLAGS;

export type CommandHelpTopic = "pack" | "trace" | "scope" | "git" | "grep" | "migrate";

export const COMMAND_HELP_FLAGS = {
	pack: [
		"entry",
		"include",
		"exclude",
		"scope",
		"name",
		"format",
		"depth",
		"dryRun",
		"cmd",
		"cmdTimeout",
		"failOnCmdError",
		"help",
	],
	trace: [
		"target",
		"depth",
		"include",
		"exclude",
		"name",
		"format",
		"dryRun",
		"cmd",
		"cmdTimeout",
		"failOnCmdError",
		"help",
	],
	scope: [
		"key",
		"all",
		"list",
		"exclude",
		"format",
		"dryRun",
		"cmd",
		"cmdTimeout",
		"failOnCmdError",
		"help",
	],
	git: [
		"changed",
		"staged",
		"unstaged",
		"untracked",
		"commit",
		"range",
		"against",
		"includeDiff",
		"include",
		"exclude",
		"name",
		"format",
		"dryRun",
		"cmd",
		"cmdTimeout",
		"failOnCmdError",
		"help",
	],
	grep: [
		"query",
		"any",
		"grepAll",
		"regex",
		"not",
		"within",
		"skip",
		"include",
		"exclude",
		"name",
		"format",
		"dryRun",
		"cmd",
		"cmdTimeout",
		"failOnCmdError",
		"help",
	],
	migrate: [
		"write",
		"check",
	],
} as const satisfies Record<CommandHelpTopic, readonly PublicHelpFlagName[]>;

export const FLAG_DESCRIPTION_OVERRIDES = {
	trace: {
		name: "Output basename for this trace.",
		depth: "Dependency traversal depth. Defaults to configured depth.",
	},
	git: {
		name: "Output basename for this run.",
	},
	grep: {
		name: "Output basename for this run.",
	},
} as const satisfies Partial<Record<CommandHelpTopic, Partial<Record<PublicHelpFlagName, string>>>>;

