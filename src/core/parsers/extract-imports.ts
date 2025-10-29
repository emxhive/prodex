// @ts-nocheck

import fs from "fs/promises";
import { init, parse } from "es-module-lexer";

let initialized = false;

export async function extractImports(filePath, code) {
    if (!initialized) {
        await init;
        initialized = true;
    }

    let src = code;
    if (src == null) {
        try {
            src = await fs.readFile(filePath, "utf8");
        } catch {
            return new Set();
        }
    }

    try {
        const [imports] = parse(src);
        const out = new Set();
        for (const i of imports) if (i.n) out.add(i.n);
        return out;
    } catch {
        return fallbackRegex(src);
    }
}

function fallbackRegex(code) {
    const patterns = [
        /import\s+[^'"]*['"]([^'"]+)['"]/g,
        /import\(\s*['"]([^'"]+)['"]\s*\)/g,
        /require\(\s*['"]([^'"]+)['"]\s*\)/g,
        /export\s+\*\s+from\s+['"]([^'"]+)['"]/g,
    ];

    const matches = new Set();
    for (const r of patterns) {
        let m;
        while ((m = r.exec(code))) matches.add(m[1]);
    }
    return matches;
}
