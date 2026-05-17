export function toStringList(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value
			.map((item) => (typeof item === "string" ? item.trim() : ""))
			.filter(Boolean);
	}
	if (typeof value === "string") return splitStringList(value);
	return [];
}

export function splitStringList(value: string): string[] {
	return value.split(",").map((item) => item.trim()).filter(Boolean);
}
