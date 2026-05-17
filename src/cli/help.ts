import pkg from "../../package.json";

export function renderHelp(topic?: string): string {
	if (topic === "run") return renderRunHelp();
	if (topic === "init") return renderInitHelp();
	if (topic === "profiles") return renderProfilesHelp();
	if (topic === "migrate") return renderMigrateHelp();

	return [
		"Usage:",
		"  prodex run [root] [options]",
		"  prodex init [root]",
		"  prodex profiles [root]",
		"  prodex migrate [root] [--write|--check]",
		"",
		"Global options:",
		"  -h, --help                Show help.",
		"  -v, --version             Show version.",
		"",
		"Run `prodex <command> --help` for command-specific help.",
	].join("\n");
}

export function renderVersion(): string {
	return `prodex v${pkg.version}`;
}

function renderRunHelp(): string {
	return [
		"Usage:",
		"  prodex run [root] [options]",
		"",
		"Options:",
		"  -e, --entry <glob>        Entry file/glob. Repeatable and comma-aware.",
		"  -i, --include <glob>      Extra file/glob to append. Repeatable and comma-aware.",
		"  -x, --exclude <glob>      File/glob to skip. Repeatable and comma-aware.",
		"  -p, --profile <name>      Run a named profile. Repeatable.",
		"  --all-profiles            Run every configured profile.",
		"  -n, --name <name>         Output basename for this run.",
		"  -F, --format <md|txt>     Output format.",
		"  --max-depth <number>      Maximum dependency traversal depth.",
		"  --max-files <number>      Maximum traced file count.",
		"  -d, --debug               Enable debug logs.",
		"  -h, --help                Show run help.",
	].join("\n");
}

function renderInitHelp(): string {
	return [
		"Usage:",
		"  prodex init [root]",
		"",
		"Create a prodex.json file in the target root.",
	].join("\n");
}

function renderProfilesHelp(): string {
	return [
		"Usage:",
		"  prodex profiles [root]",
		"",
		"List configured profile keys without running Prodex.",
	].join("\n");
}

function renderMigrateHelp(): string {
	return [
		"Usage:",
		"  prodex migrate [root]",
		"  prodex migrate [root] --write",
		"  prodex migrate [root] --check",
		"",
		"Preview, check, or write a prodex.json migration to config version 4.",
		"",
		"Options:",
		"  --write                  Back up and update prodex.json.",
		"  --check                  Exit nonzero if migration is required.",
	].join("\n");
}
