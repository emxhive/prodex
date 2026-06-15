import type { CliParseResult, ProdexFlags } from "../types";
import { splitStringList } from "../config/string-list";
import { COMMANDS, FLAG_ALIASES, FLAGS_BY_LONG, FLAGS_BY_SHORT, type FlagSpec } from "./flag-specs";

export function parseCliInput(argv: string[] = process.argv): CliParseResult {
	const tokens = stripExecutable(argv);
	const warnings: string[] = [];
	const errors: string[] = [];
	const flags: Partial<ProdexFlags> = {};

	if (!tokens.length) {
		errors.push("Missing command. Use `prodex pack`, `prodex trace`, `prodex scope`, or `prodex migrate`.");
		return { warnings, errors };
	}

	if (tokens.includes("--version") || tokens.includes("-v")) {
		return { command: { kind: "version" }, warnings, errors };
	}

	if (tokens[0] === "--help" || tokens[0] === "-h") {
		return { command: { kind: "help" }, warnings, errors };
	}

	const commandName = tokens[0];
	if (!isCommand(commandName)) {
		errors.push(`Unknown command "${commandName}". Use pack, trace, scope, or migrate.`);
		return { warnings, errors };
	}

	let rootArg: string | undefined;
	for (let i = 1; i < tokens.length; i++) {
		const token = tokens[i];

		if (!token) continue;
		if (token.startsWith("--")) {
			const consumed = readLongFlag(tokens, i, flags, errors);
			i += consumed;
			continue;
		}
		if (token.startsWith("-") && token !== "-") {
			const consumed = readShortFlag(tokens, i, flags, errors);
			i += consumed;
			continue;
		}
		if (rootArg) {
			errors.push(`Unexpected positional argument "${token}". Only one root path is accepted.`);
			continue;
		}
		rootArg = token;
	}

	if ((flags as any).help) return { command: { kind: "help", topic: commandName }, warnings, errors };

	// Enforce deprecation checks for old syntax
	if (commandName === "run") {
		errors.push("`prodex run` has been replaced.\nUse `prodex pack`, `prodex trace`, or `prodex scope`.");
	}
	if (commandName === "profiles") {
		errors.push("`prodex profiles` has been replaced.\nUse `prodex scope --list`.");
	}
	if (flags.profile !== undefined) {
		errors.push("`--profile` has been replaced.\nUse `prodex pack --scope <key>` to merge scopes into one pack, or `prodex scope -k <key>` to run configured scopes separately.");
	}
	if ((flags as any).allProfiles !== undefined) {
		errors.push("`--all-profiles` has been replaced.\nUse `--all` with `prodex scope`.");
	}
	if ((flags as any).maxDepth !== undefined) {
		errors.push("`--max-depth` has been replaced.\nUse `--depth`.");
	}

	if (errors.length) {
		return { warnings, errors };
	}

	if (commandName === "init") return { command: { kind: "init", rootArg }, warnings, errors };
	if (commandName === "migrate") {
		return { command: { kind: "migrate", rootArg, write: !!(flags as any).write, check: !!(flags as any).check }, warnings, errors };
	}
	if (commandName === "pack") {
		return { command: { kind: "pack", rootArg, flags }, warnings, errors };
	}
	if (commandName === "trace") {
		return { command: { kind: "trace", rootArg, flags }, warnings, errors };
	}
	if (commandName === "scope") {
		return { command: { kind: "scope", rootArg, flags }, warnings, errors };
	}

	return { warnings, errors };
}

function stripExecutable(argv: string[]): string[] {
	const [first, second, ...rest] = argv;
	const firstBase = first ? basename(first) : "";
	const secondBase = second ? basename(second) : "";

	if (/^node(\.exe)?$/.test(firstBase)) return rest;
	if (secondBase.startsWith("prodex") && firstBase) return rest;
	if (firstBase.startsWith("prodex")) return argv.slice(1);
	return argv;
}

function basename(value: string): string {
	return value.split(/[\\/]/).pop()?.toLowerCase() ?? "";
}

function isCommand(token: string): boolean {
	return COMMANDS.includes(token as any);
}

function readLongFlag(tokens: string[], index: number, flags: Partial<ProdexFlags>, errors: string[]): number {
	const token = tokens[index];
	const raw = token.slice(2);
	const equalsAt = raw.indexOf("=");
	const rawName = equalsAt === -1 ? raw : raw.slice(0, equalsAt);
	const name = FLAG_ALIASES[rawName] ?? rawName;
	const inlineValue = equalsAt === -1 ? undefined : raw.slice(equalsAt + 1);
	const spec = FLAGS_BY_LONG.get(name as any);

	if (!spec) {
		errors.push(`Unknown flag "--${rawName}".`);
		return 0;
	}

	if (spec.type === "boolean") {
		(flags as any)[spec.long] = inlineValue === undefined ? true : coerceBoolean(inlineValue);
		return 0;
	}

	const value = inlineValue ?? tokens[index + 1];
	if (value === undefined || value.startsWith("-")) {
		errors.push(`Flag "--${rawName}" expects a value.`);
		return 0;
	}

	assignFlag(flags, spec, value, errors);
	return inlineValue === undefined ? 1 : 0;
}

function readShortFlag(tokens: string[], index: number, flags: Partial<ProdexFlags>, errors: string[]): number {
	const token = tokens[index];
	const cluster = token.slice(1);

	if (cluster.length > 1) {
		for (const ch of cluster) {
			const spec = FLAGS_BY_SHORT.get(ch);
			if (!spec) {
				errors.push(`Unknown flag "-${ch}".`);
				continue;
			}
			if (spec.type !== "boolean") {
				errors.push(`Flag "-${ch}" expects a value and cannot be used in a short flag cluster.`);
				continue;
			}
			(flags as any)[spec.long] = true;
		}
		return 0;
	}

	const spec = FLAGS_BY_SHORT.get(cluster);
	if (!spec) {
		errors.push(`Unknown flag "-${cluster}".`);
		return 0;
	}
	if (spec.type === "boolean") {
		(flags as any)[spec.long] = true;
		return 0;
	}

	const value = tokens[index + 1];
	if (value === undefined || value.startsWith("-")) {
		errors.push(`Flag "-${cluster}" expects a value.`);
		return 0;
	}

	assignFlag(flags, spec, value, errors);
	return 1;
}

function assignFlag(flags: Partial<ProdexFlags>, spec: FlagSpec, value: string, errors: string[]): void {
	if (spec.type === "number") {
		const numeric = Number(value);
		if (!Number.isFinite(numeric)) errors.push(`Flag "--${spec.long}" expected a number but got "${value}".`);
		else (flags as any)[spec.long] = numeric;
		return;
	}
	if (spec.type === "list") {
		const values = splitStringList(value);
		const current = ((flags as any)[spec.long] ?? []) as string[];
		(flags as any)[spec.long] = [...current, ...values];
		return;
	}
	if (spec.long === "format" && !["md", "txt"].includes(value)) {
		errors.push(`Flag "--format" expected "md" or "txt" but got "${value}".`);
		return;
	}
	(flags as any)[spec.long] = value;
}

function coerceBoolean(value: string): boolean {
	return !["0", "false", "no", "off"].includes(value.toLowerCase());
}
