import fs from "fs";
import path from "path";
import { normalizePath } from "./path";

export function isGlobPattern(str: string): boolean {
	return str.includes("*") || str.includes("?") || str.includes("[") || str.includes("{");
}

export interface NormalizationOptions {
	role?: "entry" | "include" | "exclude" | "skip" | "within";
}

/**
 * Normalizes a path or glob pattern.
 *
 * For "exclude" or "skip" roles:
 * - If the pattern is not a glob and does not exist as a file, and has no extension,
 *   it is assumed to be a directory shorthand and is expanded recursively (e.g., "dist" -> "dist/**").
 * - Note: Ambiguous extensionless filenames (such as "README", "LICENSE", "Dockerfile", "Makefile")
 *   are also treated as directories and expanded recursively if they do not exist on disk.
 *
 * For "entry" or "include" roles:
 * - Non-existing directory-like inputs are NOT expanded and are kept as literal paths to preserve strictness.
 *
 * For all roles:
 * - Existing directories are always expanded recursively (e.g., "src" -> "src/**").
 */
export function normalizePathOrGlob(pattern: string, root: string, options?: NormalizationOptions): string {
	const trimmed = String(pattern ?? "").trim();
	if (!trimmed) return "";

	// 1. If it has glob characters, return normalized pattern
	if (isGlobPattern(trimmed)) {
		return normalizePath(trimmed);
	}

	// 2. Resolve absolute path to check disk status
	const absPath = path.resolve(root, trimmed);
	let isDir = false;
	let isFile = false;

	try {
		const stat = fs.statSync(absPath);
		isDir = stat.isDirectory();
		isFile = stat.isFile();
	} catch {
		// Path does not exist or cannot be read
	}

	// 3. Existing directories are expanded recursively
	if (isDir) {
		const normalized = normalizePath(trimmed);
		if (normalized.endsWith("/")) {
			return normalized + "**";
		}
		return normalized + "/**";
	}

	// 4. Role-aware normalization for exclude/skip roles (Option B)
	const role = options?.role;
	if (role === "exclude" || role === "skip") {
		if (!isFile) {
			const normalized = normalizePath(trimmed);
			const hasExtension = path.extname(trimmed) !== "";
			// Expand if it ends with a slash or has no extension
			if (normalized.endsWith("/") || !hasExtension) {
				return normalized.endsWith("/") ? normalized + "**" : normalized + "/**";
			}
		}
	}

	return normalizePath(trimmed);
}
