import { ReferenceSemantics } from "../../types/reference-semantics";

export function classifyJsTsModuleSemantics(specifier: string): ReferenceSemantics {
	const trimmed = specifier.trim();
	// 1. Relative path-shaped module reference
	if (trimmed.startsWith("./") || trimmed.startsWith("../")) {
		return { domain: 'module', resolution: 'relative', anchor: 'source' };
	}
	// 2. POSIX absolute path-shaped module reference
	if (trimmed.startsWith("/")) {
		return { domain: 'module', resolution: 'absolute' };
	}
	// 3. Windows absolute path-shaped module reference
	if (trimmed.startsWith("\\") || /^[a-zA-Z]:[\\\/]/.test(trimmed)) {
		return { domain: 'module', resolution: 'absolute' };
	}
	// 4. URI reference
	if (/^(https?|ftp|file):\/\//.test(trimmed)) {
		return { domain: 'uri', resolution: 'absolute' };
	}
	// 5. Non-relative logical module identity (default)
	return { domain: 'module', resolution: 'logical' };
}
