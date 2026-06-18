export function uniqueTrimmed(items: string[]): string[] {
	return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}
