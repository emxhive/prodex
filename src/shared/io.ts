import path from "path";
import fs from "fs";

/**
 * Read a file safely. Returns "" if the file cannot be read.
 */
export function readFileSafe(p: string): string {
	try {
		return fs.readFileSync(p, "utf8");
	} catch {
		return "";
	}
}

/**
 * Return a path relative to a root, normalized for forward slashes.
 */
export function rel(p: string, root = process.cwd()): string {
	return path.relative(root, p).replaceAll("\\", "/");
}
