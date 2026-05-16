export function normalizePath(value: string): string {
	return value.replace(/\\/g, "/");
}

export function sanitizeFileName(value: string, fallback = "combined"): string {
	const cleaned = value.trim().replace(/[<>:"/\\|?*]+/g, "_");
	return cleaned || fallback;
}
