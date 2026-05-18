import path from "path";
import { unique } from "../tracing/trace-stats";

export function smartNaming(entries: string[]): string {
	const names = unique(entries.map((file) => path.basename(file, path.extname(file))));
	if (names.length === 1) return names[0];
	if (names.length === 2) return `${names[0]}-${names[1]}`;
	if (names.length > 2) return `${names[0]}-and-${names.length - 1}more`;
	return "prodex";
}

export function shortTimestamp(): string {
	const d = new Date();
	const yy = String(d.getFullYear()).slice(-2);
	const MM = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `${yy}${MM}${dd}-${hh}${mm}`;
}
