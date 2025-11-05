// File: src/shared/io.ts

import { CacheManager } from "../core/managers/cache";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";

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
 * Cached version of fs.stat().
 * Takes a cache namespace to preserve behavior across resolvers.
 */
export async function safeStatCached(ns: string, p: string): Promise<import("fs").Stats | null> {
	const cached = CacheManager.get(ns, p);
	if (cached !== undefined) return cached;
	try {
		const st = await fsp.stat(p);
		CacheManager.set(ns, p, st);
		return st;
	} catch {
		CacheManager.set(ns, p, null);
		return null;
	}
}

/**
 * Return a path relative to a root, normalized for forward slashes.
 */
export function rel(p: string, root = process.cwd()): string {
	return path.relative(root, p).replaceAll("\\", "/");
}
/**
 * Get a root-relative version of a path.
 */
