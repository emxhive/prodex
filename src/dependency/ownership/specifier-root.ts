export function parsePackageSpecifierRoot(specifier: string): string | undefined {
	const trimmed = specifier.trim();
	if (!trimmed) return undefined;

	const withoutNodePrefix = trimmed.startsWith("node:") ? trimmed.slice("node:".length) : trimmed;
	if (!withoutNodePrefix || withoutNodePrefix.startsWith(".") || withoutNodePrefix.startsWith("/") || withoutNodePrefix.startsWith("\\")) {
		return undefined;
	}

	const normalized = withoutNodePrefix.replace(/\\/g, "/");
	const parts = normalized.split("/").filter(Boolean);
	if (!parts.length) return undefined;

	if (parts[0].startsWith("@")) {
		if (parts.length < 2) return parts[0];
		return `${parts[0]}/${parts[1]}`;
	}

	return parts[0];
}

export function getPackageSubpath(specifier: string, specifierRoot: string): string {
	const normalized = specifier.trim().replace(/\\/g, "/");
	if (normalized === specifierRoot) return "";
	if (!normalized.startsWith(`${specifierRoot}/`)) return "";
	return normalized.slice(specifierRoot.length + 1);
}
