import path from "path";
import type { CliParseResult, ProdexFlags } from "../types";

type FlagSpec = {
	long: keyof ProdexFlags | "help" | "version" | "shortcuts";
	short?: string;
	type: "boolean" | "string" | "number" | "list";
};

const FLAGS: FlagSpec[] = [
	{ long: "files", short: "f", type: "list" },
	{ long: "include", short: "i", type: "list" },
	{ long: "exclude", short: "x", type: "list" },
	{ long: "name", short: "n", type: "string" },
	{ long: "txt", short: "t", type: "boolean" },
	{ long: "limit", short: "l", type: "number" },
	{ long: "ci", short: "c", type: "boolean" },
	{ long: "debug", short: "d", type: "boolean" },
	{ long: "shortcut", short: "a", type: "string" },
	{ long: "shortcuts", type: "boolean" },
	{ long: "help", short: "h", type: "boolean" },
	{ long: "version", short: "v", type: "boolean" },
];

const BY_LONG = new Map(FLAGS.map((flag) => [flag.long, flag]));
const BY_SHORT = new Map(FLAGS.filter((flag) => flag.short).map((flag) => [flag.short!, flag]));

export function parseCliInput(argv: string[] = process.argv): CliParseResult {
	const tokens = stripExecutable(argv);
	const warnings: string[] = [];
	const errors: string[] = [];
	const flags: Partial<ProdexFlags> = {};
	const shortcuts: string[] = [];
	let shortcutAll = false;
	let commandName = "run";
	let rootArg: string | undefined;

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];

		if (!token) continue;
		if (i === 0 && isCommand(token)) {
			commandName = token;
			continue;
		}
		if (token === "@") {
			shortcutAll = true;
			continue;
		}
		if (token.startsWith("@")) {
			const name = token.slice(1).trim();
			if (name) shortcuts.push(name);
			else shortcutAll = true;
			continue;
		}
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

	if ((flags as any).help) return { command: { kind: "help" }, warnings, errors };
	if ((flags as any).version) return { command: { kind: "version" }, warnings, errors };
	if ((flags as any).shortcuts === true) return { command: { kind: "shortcuts", rootArg }, warnings, errors };
	if (commandName === "help") return { command: { kind: "help" }, warnings, errors };
	if (commandName === "version") return { command: { kind: "version" }, warnings, errors };

	const selected = unique([
		...shortcuts,
		...(typeof flags.shortcut === "string" && flags.shortcut.trim() ? [flags.shortcut.trim()] : []),
	]);

	if (shortcutAll) flags.shortcutAll = true;
	if (selected.length) flags.shortcuts = selected;
	if (!shortcutAll && selected.length === 1) flags.shortcut = selected[0];
	if (shortcutAll || selected.length > 1) delete flags.shortcut;

	if (commandName === "init") {
		return { command: { kind: "init", rootArg }, warnings, errors };
	}
	if (commandName === "shortcuts") {
		return { command: { kind: "shortcuts", rootArg }, warnings, errors };
	}
	if (commandName !== "run") {
		errors.push(`Unknown command "${commandName}".`);
		return { warnings, errors };
	}

	return { command: { kind: "run", rootArg, flags }, warnings, errors };
}

function stripExecutable(argv: string[]): string[] {
	const [first, second, ...rest] = argv;
	const firstBase = first ? path.basename(first).toLowerCase() : "";
	const secondBase = second ? path.basename(second).toLowerCase() : "";

	if (/^node(\.exe)?$/.test(firstBase)) return rest;
	if (secondBase.startsWith("prodex") && firstBase) return rest;
	if (firstBase.startsWith("prodex")) return argv.slice(1);
	return argv;
}

function isCommand(token: string): boolean {
	return ["run", "init", "shortcuts", "help", "version"].includes(token);
}

function readLongFlag(tokens: string[], index: number, flags: Partial<ProdexFlags>, errors: string[]): number {
	const token = tokens[index];
	const raw = token.slice(2);
	const equalsAt = raw.indexOf("=");
	const name = equalsAt === -1 ? raw : raw.slice(0, equalsAt);
	const inlineValue = equalsAt === -1 ? undefined : raw.slice(equalsAt + 1);
	const spec = BY_LONG.get(name as any);

	if (!spec) {
		errors.push(`Unknown flag "--${name}".`);
		return 0;
	}

	if (spec.type === "boolean") {
		(flags as any)[spec.long] = inlineValue === undefined ? true : coerceBoolean(inlineValue);
		return 0;
	}

	const value = inlineValue ?? tokens[index + 1];
	if (value === undefined || value.startsWith("-")) {
		errors.push(`Flag "--${name}" expects a value.`);
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
			const spec = BY_SHORT.get(ch);
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

	const spec = BY_SHORT.get(cluster);
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
		(flags as any)[spec.long] = value
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean);
		return;
	}
	(flags as any)[spec.long] = value;
}

function coerceBoolean(value: string): boolean {
	return !["0", "false", "no", "off"].includes(value.toLowerCase());
}

function unique<T>(values: T[]): T[] {
	return [...new Set(values)];
}
