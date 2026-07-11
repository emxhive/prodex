import { ReferenceSemantics } from "../../types/reference-semantics";

export function classifyPhpFileSemantics(specifier: string): ReferenceSemantics {
	const trimmed = specifier.trim();
	// 1. Relative path-shaped file reference
	if (trimmed.startsWith("./") || trimmed.startsWith("../")) {
		return { domain: 'file', resolution: 'relative', anchor: 'runtime' };
	}
	// 2. Absolute filesystem path
	if (trimmed.startsWith("/") || trimmed.startsWith("\\") || /^[a-zA-Z]:[\\\/]/.test(trimmed)) {
		return { domain: 'file', resolution: 'absolute' };
	}
	// 3. Bare/search form
	return { domain: 'file', resolution: 'search' };
}
