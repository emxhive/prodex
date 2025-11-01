// @ts-nocheck

import { VALID_GLOB_CHARS } from "../constants/config";

export function unique(arr: string[]): string[] {
	return [...new Set(arr)];
}
export function setDiff(A, B) {
	return new Set([...A].filter((x) => !B.has(x)));
}
export function toArray(v) {
	return Array.isArray(v) ? v : [v];
}

/** Compact YYMMDD-HHmm timestamp for versioned filenames. */
export function shortTimestamp(): string {
	const d = new Date();
	const yy = String(d.getFullYear()).slice(-2);
	const MM = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `${yy}${MM}${dd}-${hh}${mm}`;
}

export function normalizePatterns(input?: string | string[]): string[] {
	if (!input) return [];

	let arr: string[];

	if (typeof input === "string") {
		arr = input.split(",").map((s) => s.trim());
	} else if (Array.isArray(input)) {
		arr = input.map((s) => (typeof s === "string" ? s.trim() : ""));
	} else {
		return [];
	}

	return arr
		.filter((s) => s.length > 0)
		.map((s) => s.replace(/\\/g, "/")) // normalize slashes
		.filter((s) => {
			const valid = VALID_GLOB_CHARS.test(s);
			if (!valid) console.warn(`⚠️  Invalid glob pattern skipped: "${s}"`);
			return valid;
		});
}
