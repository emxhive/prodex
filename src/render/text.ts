import { readFileSafe, rel } from "../shared";

export function tocTxt(files: string[], root = process.cwd()): string {
	const sorted = [...files].sort((a, b) => a.localeCompare(b));
	return ["##==== Combined Scope ====", ...sorted.map((file) => "## - " + rel(file, root))].join("\n") + "\n\n";
}

export function renderTxt(filePath: string, root = process.cwd()): string {
	const relativePath = rel(filePath, root);
	const code = readFileSafe(filePath);
	return ["##==== path: " + relativePath + " ====", "##region " + relativePath, code, "##endregion", ""].join("\n");
}
