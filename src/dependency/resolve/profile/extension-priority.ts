import path from "path";

export const SOURCE_EQUIV_MAP: Record<string, string[]> = {
	".js": [".ts", ".tsx", ".jsx"],
	".jsx": [".tsx"],
};

export function isDeclarationOnlyPath(filePath: string): boolean {
	return /\.d\.ts$/.test(filePath);
}

export function getExtensionPriorityGroups(sourceExtOrLanguage: string | undefined): string[][] {
	if (!sourceExtOrLanguage) {
		return [];
	}

	const normalized = sourceExtOrLanguage.toLowerCase().trim();

	// Match extension or language name
	if (normalized === ".tsx" || normalized === "tsx") {
		return [[".tsx"], [".ts"], [".jsx"], [".js"]];
	}
	if (normalized === ".ts" || normalized === "typescript" || normalized === "ts") {
		return [[".ts"], [".tsx"], [".js"], [".jsx"]];
	}
	if (normalized === ".jsx" || normalized === "jsx") {
		return [[".jsx"], [".tsx"], [".js"], [".ts"]];
	}
	if (normalized === ".js" || normalized === "javascript" || normalized === "js") {
		return [[".js"], [".ts"], [".jsx"], [".tsx"]];
	}

	return [];
}
