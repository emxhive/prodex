import type { CliParseResult, ProdexFlags } from "../types";

type FlagSpec = {
	long: keyof ProdexFlags | "help" | "version" | "profile" | "write" | "check";
	short?: string;
	type: "boolean" | "string" | "number" | "list";
};

const FLAGS: FlagSpec[] = [
	{ long: "entry", short: "e", type: "list" },
	{ long: "include", short: "i", type: "list" },
	{ long: "exclude", short: "x", type: "list" },
	{ long: "profile", short: "p", type: "list" },
	{ long: "allProfiles", type: "boolean" },
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

const FLAG_ALIASES: Record<string, FlagSpec["long"]> = {
	"all-profiles": "allProfiles",
	"max-depth": "maxDepth",
	"max-files": "maxFiles",
};

const BY_LONG = new Map(FLAGS.map((flag) => [flag.long, flag]));
const BY_SHORT = new Map(FLAGS.filter((flag) => flag.short).map((flag) => [flag.short!, flag]));

export function parseCliInput(argv: string[] = process.argv): CliParseResult {
	const tokens = stripExecutable(argv);
	const warnings: string[] = [];
	const errors: string[] = [];
	const flags: Partial<ProdexFlags> = {};

	if (!tokens.length) {
		errors.push("Missing command. Use `prodex run`, `prodex init`, `prodex profiles`, or `prodex migrate`.");
		return { warnings, errors };
	}

	if (tokens.includes("--version") || tokens.includes("-v")) {
		return { command: { kind: "version" }, warnings, errors };
	}

	const commandName = tokens[0];
	if (!isCommand(commandName)) {
		errors.push(`Unknown command "${commandName}". Use run, init, profiles, or migrate.`);
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

	if (commandName === "init") return { command: { kind: "init", rootArg }, warnings, errors };
	if (commandName === "profiles") return { command: { kind: "profiles", rootArg }, warnings, errors };
	if (commandName === "migrate") {
		return { command: { kind: "migrate", rootArg, write: !!(flags as any).write, check: !!(flags as any).check }, warnings, errors };
	}
	return { command: { kind: "run", rootArg, flags }, warnings, errors };
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
	return ["run", "init", "profiles", "migrate"].includes(token);
}

function readLongFlag(tokens: string[], index: number, flags: Partial<ProdexFlags>, errors: string[]): number {
	const token = tokens[index];
	const raw = token.slice(2);
	const equalsAt = raw.indexOf("=");
	const rawName = equalsAt === -1 ? raw : raw.slice(0, equalsAt);
	const name = FLAG_ALIASES[rawName] ?? rawName;
	const inlineValue = equalsAt === -1 ? undefined : raw.slice(equalsAt + 1);
	const spec = BY_LONG.get(name as any);

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
		const values = value
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean);
		const target = spec.long === "profile" ? "profiles" : spec.long;
		const current = ((flags as any)[target] ?? []) as string[];
		(flags as any)[target] = [...current, ...values];
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
