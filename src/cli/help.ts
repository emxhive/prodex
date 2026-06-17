import pkg from "../../package.json";

export function renderHelp(topic?: string): string {
	if (topic === "pack") return renderPackHelp();
	if (topic === "trace") return renderTraceHelp();
	if (topic === "scope") return renderScopeHelp();
	if (topic === "git") return renderGitHelp();
	if (topic === "grep") return renderGrepHelp();
	if (topic === "init") return renderInitHelp();
	if (topic === "migrate") return renderMigrateHelp();

	return [
		"Usage:",
		"  prodex pack [root] [options]",
		"  prodex trace [root] --target <target> [--depth <number>] [options]",
		"  prodex scope [root] [options]",
		"  prodex git [root] [options]",
		"  prodex grep [root] --query \"text\" [options]",
		"  prodex init [root]",
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

function renderPackHelp(): string {
	return [
		"Usage:",
		"  prodex pack [root] [options]",
		"",
		"Options:",
		"  -e, --entry <glob>       Entry file/glob. Repeatable and comma-aware.",
		"  -i, --include <glob>      Extra file/glob to append. Repeatable and comma-aware.",
		"  -x, --exclude <glob>      File/glob to skip. Repeatable and comma-aware.",
		"  -s, --scope <key>         Merge a configured scope's files.",
		"  -n, --name <name>         Output basename for this pack.",
		"  -F, --format <md|txt>     Output format.",
		"  -d, --depth <number>      Maximum dependency traversal depth.",
		"  --max-files <number>      Maximum traced file count.",
		"  --dry-run                 Perform a dry-run without writing output files.",
		"  --cmd <command>           Run command sequentially for evidence capture. Repeatable.",
		"  --cmd-timeout <seconds>   Command execution timeout (default: 180).",
		"  --fail-on-cmd-error       Enforce nonzero exit if commands fail.",
		"  -h, --help                Show pack help.",
	].join("\n");
}

function renderTraceHelp(): string {
	return [
		"Usage:",
		"  prodex trace [root] --target <target> [--depth <number>] [options]",
		"",
		"Options:",
		"  -t, --target <target>    Target file/module to resolve and trace from. Repeatable and comma-aware.",
		"  -d, --depth <number>     Dependency traversal depth. Defaults to configured depth.",
		"  -i, --include <glob>     Extra path/glob to append directly.",
		"  -x, --exclude <glob>     Path/glob to skip.",
		"  -n, --name <name>         Output basename for this trace.",
		"  -F, --format <md|txt>     Output format.",
		"  --max-files <number>      Maximum traced file count.",
		"  --dry-run                 Perform a dry-run without writing output files.",
		"  --cmd <command>           Run command sequentially for evidence capture. Repeatable.",
		"  --cmd-timeout <seconds>   Command execution timeout (default: 180).",
		"  --fail-on-cmd-error       Enforce nonzero exit if commands fail.",
		"  -h, --help                Show trace help.",
	].join("\n");
}

function renderScopeHelp(): string {
	return [
		"Usage:",
		"  prodex scope [root] [options]",
		"",
		"Options:",
		"  -k, --key <key>           Scope key to execute. Repeatable and comma-aware.",
		"  -a, --all                 Run all configured scopes.",
		"  --list                    List configured scope keys.",
		"  -F, --format <md|txt>     Output format.",
		"  --dry-run                 Perform a dry-run without writing output files.",
		"  --cmd <command>           Run command sequentially for evidence capture. Repeatable.",
		"  --cmd-timeout <seconds>   Command execution timeout (default: 180).",
		"  --fail-on-cmd-error       Enforce nonzero exit if commands fail.",
		"  -h, --help                Show scope help.",
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

function renderMigrateHelp(): string {
	return [
		"Usage:",
		"  prodex migrate [root]",
		"  prodex migrate [root] --write",
		"  prodex migrate [root] --check",
		"",
		"Preview, check, or write a prodex.json migration to config version 5.",
		"",
		"Options:",
		"  --write                  Back up and update prodex.json.",
		"  --check                  Exit nonzero if migration is required.",
	].join("\n");
}

function renderGitHelp(): string {
	return [
		"Usage:",
		"  prodex git [root] [options]",
		"",
		"Options:",
		"  --changed                 Include staged, unstaged, and untracked changes (default).",
		"  --staged                  Include staged changes.",
		"  --unstaged                Include unstaged changes.",
		"  --untracked               Include untracked files.",
		"  --include-diff            Include full git diff output in generic sections.",
		"  -i, --include <glob>      Extra file/glob to append. Repeatable and comma-aware.",
		"  -x, --exclude <glob>      File/glob to skip. Repeatable and comma-aware.",
		"  -n, --name <name>         Output basename for this run.",
		"  -F, --format <md|txt>     Output format.",
		"  --dry-run                 Perform a dry-run without writing output files.",
		"  --cmd <command>           Run command sequentially for evidence capture. Repeatable.",
		"  --cmd-timeout <seconds>   Command execution timeout (default: 180).",
		"  --fail-on-cmd-error       Enforce nonzero exit if commands fail.",
		"  -h, --help                Show git help.",
	].join("\n");
}

function renderGrepHelp(): string {
	return [
		"Usage:",
		"  prodex grep [root] [options]",
		"",
		"Options:",
		"  -q, --query <text>        fixed-string search",
		"  --any <list>              OR fixed-string search",
		"  --all <list>              AND fixed-string search",
		"  -r, --regex <pattern>     regex search",
		"  --not <list>              fixed-string negative file filter",
		"  --within <list>           search only inside these paths/globs",
		"  --skip <list>             do not search inside these paths/globs",
		"  -i, --include <glob>      Extra file/glob to append. Repeatable and comma-aware.",
		"  -x, --exclude <glob>      File/glob to skip. Repeatable and comma-aware.",
		"  -n, --name <name>         Output basename for this run.",
		"  -F, --format <md|txt>     Output format.",
		"  --max-files <number>      Maximum matched files count.",
		"  --dry-run                 Perform a dry-run without writing output files.",
		"  --cmd <command>           Run command sequentially for evidence capture. Repeatable.",
		"  --cmd-timeout <seconds>   Command execution timeout (default: 180).",
		"  --fail-on-cmd-error       Enforce nonzero exit if commands fail.",
		"  -h, --help                Show grep help.",
	].join("\n");
}
