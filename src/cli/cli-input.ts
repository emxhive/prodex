import sade from "sade";
import path from "path";
import pkg from "../../package.json";
import fs from "fs";
import {FLAG_MAP, FLAG_SHORT_MAP} from "../constants/flags";
import type {ParsedInput} from "../types";

type ShortcutExtract = {
    argv: string[];
    shortcutAll: boolean;
    shortcuts: string[];
};

function extractShortcutTokens(argv: string[]): ShortcutExtract {
    const cleaned: string[] = [];
    const shortcuts: string[] = [];
    let shortcutAll = false;

    for (const arg of argv) {
        if (arg === "@") {
            shortcutAll = true;
            continue;
        }
        if (arg?.startsWith("@")) {
            const name = arg.slice(1).trim();
            if (!name) shortcutAll = true;
            else shortcuts.push(name);
            continue;
        }
        cleaned.push(arg);
    }

    return {argv: cleaned, shortcutAll, shortcuts};
}

/**
 * Unified CLI parser powered by Sade and FLAG_MAP.
 * Returns { root, flags, warnings, errors }.
 */
export function parseCliInput(argv: string[] = process.argv) {
    if (argv.includes("-v") || argv.includes("--version")) {
        console.log(`prodex v${pkg.version}`);
        process.exit(0);
    }

    const extracted = extractShortcutTokens(argv);
    const argvCleaned = extracted.argv;

    const program = sade("prodex [root]");
    registerFlags(program);

    let parsed: ParsedInput = {rootArg: "", root: undefined, flags: {}};

    program.action((root: string | undefined, opts: Record<string, any>) => {
        const cwd = process.cwd();
        parsed = {
            rootArg: root,
            root: root ? path.resolve(cwd, root) : cwd,
            flags: {...opts},
        };
    });

    program.parse(argvCleaned);

    // Merge shortcut tokens (@a @b @c / @) with existing --shortcut usage.
    const fromTokens = extracted.shortcuts;
    const shortcutAll = extracted.shortcutAll;
    const fromFlag =
        typeof parsed.flags.shortcut === "string" ? parsed.flags.shortcut.trim() : "";

    const selected = [...fromTokens, ...(fromFlag ? [fromFlag] : [])].filter(Boolean);
    const uniq = Array.from(new Set(selected));

    if (shortcutAll) (parsed.flags as any).shortcutAll = true;
    if (uniq.length) (parsed.flags as any).shortcuts = uniq;

    if (!shortcutAll && uniq.length === 1) (parsed.flags as any).shortcut = uniq[0];
    else if (uniq.length > 1 || shortcutAll) delete (parsed.flags as any).shortcut;

    const warnings: string[] = [];
    const errors: string[] = [];

    parsed.flags = normalizeFlags(parsed.flags, warnings, errors);
    validateArgs(parsed, warnings, errors);

    return {...parsed, warnings, errors};
}

function registerFlags(program: ReturnType<typeof sade>) {
    for (const [key, meta] of Object.entries(FLAG_MAP)) {
        const short = meta.short ? `-${meta.short}, ` : "";
        const defaultVal = meta.type === "boolean" ? false : "";
        program.option(`${short}--${key}`, meta.description, defaultVal);
    }
}


function normalizeFlags(flags: Record<string, any>, warnings: string[], errors: string[]) {
    // Remap short aliases (-i/-f/-d) to long keys (include/files/debug)
    for (const [short, longKey] of Object.entries(FLAG_SHORT_MAP)) {
        if (flags[longKey] === undefined && flags[short] !== undefined) {
            flags[longKey] = flags[short];
            delete flags[short];
        }
    }

    for (const [key, meta] of Object.entries(FLAG_MAP)) {
        const raw = flags[key];
        if (raw === undefined) continue;

        switch (meta.type) {
            case "number": {
                const num = Number(raw);
                if (Number.isNaN(num)) errors.push(`Flag --${key} expected a number but got "${raw}"`);
                else flags[key] = num;
                break;
            }
            case "list": {
                flags[key] = String(raw)
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                break;
            }
            case "boolean": {
                flags[key] = Boolean(raw);
                break;
            }
            default: {
                if (meta.type === "string") flags[key] = String(raw);
            }
        }
    }
    return flags;
}

/** Validate path argument and report unrecognized flags. */
function validateArgs(parsed: ParsedInput, warnings: string[], errors: string[]) {
    const {rootArg} = parsed;

    if (rootArg) {
        if (!fs.existsSync(parsed.root)) {
            errors.push(`Invalid path "${rootArg}"`);
        } else if (!fs.statSync(parsed.root).isDirectory()) {
            errors.push(`Path argument "${rootArg}" is not a directory.`);
        }
    }

    const unknown = parsed.flags?._ || [];
    if (unknown.length) {
        warnings.push(`Unrecognized arguments detected [${unknown.join(", ")}]- They were ignored.`);
    }

    if (warnings.length) console.warn("Warnings:", warnings);
    if (errors.length) {
        for (const err of errors) console.error(err);
        process.exit(1);
    }
}
