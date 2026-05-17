export function parseJsonFile(text: string): unknown {
	return JSON.parse(stripBom(text));
}

export function stripBom(text: string): string {
	return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
