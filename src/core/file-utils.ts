import fs from "fs";
import path from "path";
import micromatch from "micromatch";
import fg, { Options } from "fast-glob";
import { GLOBAL_IGNORE } from "../constants/config";

/**
 * Safe micromatch.scan wrapper (compatible with micromatch v4 & v5)
 */
export async function globScan(pattern: string[], opts: Options) {
	const { absolute = true, cwd = process.cwd() } = opts;
	if (!pattern.length) return { files: [] };
	const files = await fg(pattern, {
		cwd,
		dot: true,
		onlyFiles: true,
		ignore: GLOBAL_IGNORE,
		absolute,
	});

	return { files };
}

export function generateOutputName(entries) {
	const names = entries.map((f) => path.basename(f, path.extname(f)));
	if (names.length === 1) return names[0];
	if (names.length === 2) return `${names[0]}-${names[1]}`;
	if (names.length > 2) return `${names[0]}-and-${names.length - 1}more`;
	return "unknown";
}

export function resolveOutDirPath(outDir, base, asTxt = false) {
	const ext = asTxt ? "txt" : "md";
	return path.join(outDir, `${base}-combined.${ext}`);
}
