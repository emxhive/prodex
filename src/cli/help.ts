import pkg from "../../package.json";
import { FLAGS, GREP_FLAGS, FLAG_ALIASES } from "./flag-specs";
import { PUBLIC_FLAGS, COMMAND_HELP_FLAGS, FLAG_DESCRIPTION_OVERRIDES, type CommandHelpTopic, type PublicHelpFlagName } from "./help-specs";

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

function getLongFlagCliName(longFlag: string, isGrep = false): string {
	if (isGrep && longFlag === "grepAll") return "all";
	for (const [kebab, camel] of Object.entries(FLAG_ALIASES)) {
		if (camel === longFlag) return kebab;
	}
	return longFlag.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function renderCommandHelpOptions(commandName: CommandHelpTopic): string[] {
	const allowed = COMMAND_HELP_FLAGS[commandName];
	if (!allowed) return [];

	const isGrep = commandName === "grep";
	const specs = isGrep ? GREP_FLAGS : FLAGS;

	return allowed.map((flagKey) => {
		const doc = PUBLIC_FLAGS[flagKey];
		if (!doc) {
			throw new Error(`Missing help documentation for flag "${flagKey}"`);
		}

		const spec = specs.find((s) => s.long === doc.long);
		if (!spec) {
			throw new Error(`Missing parsing spec for flag "${doc.long}"`);
		}

		const cliName = getLongFlagCliName(spec.long, isGrep);
		let leftSide = "";
		if (spec.short) {
			leftSide = `  -${spec.short}, --${cliName}`;
		} else {
			leftSide = `      --${cliName}`;
		}

		if (doc.hint) {
			leftSide += ` ${doc.hint}`;
		}

		let description = doc.description;
		if (doc.long === "help") {
			description = `Show ${commandName} help.`;
		} else {
			const commandOverrides = FLAG_DESCRIPTION_OVERRIDES[commandName as keyof typeof FLAG_DESCRIPTION_OVERRIDES];
			if (commandOverrides) {
				const override = (commandOverrides as Record<string, string>)[doc.long];
				if (override) {
					description = override;
				}
			}
		}

		return `${leftSide.padEnd(28)}${description}`;
	});
}

function renderPackHelp(): string {
	return [
		"Usage:",
		"  prodex pack [root] [options]",
		"",
		"Options:",
		...renderCommandHelpOptions("pack"),
	].join("\n");
}

function renderTraceHelp(): string {
	return [
		"Usage:",
		"  prodex trace [root] --target <target> [--depth <number>] [options]",
		"",
		"Options:",
		...renderCommandHelpOptions("trace"),
	].join("\n");
}

function renderScopeHelp(): string {
	return [
		"Usage:",
		"  prodex scope [root] [options]",
		"",
		"Options:",
		...renderCommandHelpOptions("scope"),
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
		...renderCommandHelpOptions("migrate"),
	].join("\n");
}

function renderGitHelp(): string {
	return [
		"Usage:",
		"  prodex git [root] [options]",
		"",
		"Options:",
		...renderCommandHelpOptions("git"),
	].join("\n");
}

function renderGrepHelp(): string {
	return [
		"Usage:",
		"  prodex grep [root] [options]",
		"",
		"Options:",
		...renderCommandHelpOptions("grep"),
	].join("\n");
}
