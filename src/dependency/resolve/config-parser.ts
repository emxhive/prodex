import fs from "node:fs";
import path from "node:path";
import { normalizePath } from "../../filesystem/path";

export interface ParsedTsConfig {
	baseDir: string;
	baseUrl?: string; // Resolved absolute path to baseUrl
	paths?: Record<string, string[]>; // Map of path pattern -> array of absolute path templates (e.g. "/workspace/src/*")
}

/**
 * Sequential character scan to strip block and line comments while preserving
 * comments inside string literals, and clean trailing commas.
 */
export function stripJsonComments(json: string): string {
	let out = "";
	let inString = false;
	let inLineComment = false;
	let inBlockComment = false;
	let stringChar = "";
	let lastCommaIndex = -1;

	for (let i = 0; i < json.length; i++) {
		const char = json[i];
		const next = json[i + 1];

		if (inLineComment) {
			if (char === "\n" || char === "\r") {
				inLineComment = false;
				out += char;
			}
			continue;
		}

		if (inBlockComment) {
			if (char === "*" && next === "/") {
				inBlockComment = false;
				i++; // skip /
			}
			continue;
		}

		if (inString) {
			out += char;
			if (char === "\\") {
				if (next) {
					out += next;
					i++;
				}
			} else if (char === stringChar) {
				inString = false;
			}
			continue;
		}

		if (char === "/" && next === "/") {
			inLineComment = true;
			i++;
			continue;
		}
		if (char === "/" && next === "*") {
			inBlockComment = true;
			i++;
			continue;
		}
		if (char === '"' || char === "'" || char === "`") {
			inString = true;
			stringChar = char;
			out += char;
			lastCommaIndex = -1;
			continue;
		}

		if (char === ",") {
			out += char;
			lastCommaIndex = out.length - 1;
			continue;
		}

		if (char === "}" || char === "]") {
			if (lastCommaIndex !== -1) {
				const intermediate = out.slice(lastCommaIndex + 1);
				if (/^\s*$/.test(intermediate)) {
					out = out.slice(0, lastCommaIndex) + intermediate;
				}
				lastCommaIndex = -1;
			}
			out += char;
			continue;
		}

		if (char.trim() !== "") {
			lastCommaIndex = -1;
		}

		out += char;
	}

	return out;
}

/**
 * Safely read and parse a JSONC file.
 */
export function readJsoncFile(filePath: string): any {
	const content = fs.readFileSync(filePath, "utf8");
	const cleaned = stripJsonComments(content);
	try {
		return JSON.parse(cleaned);
	} catch (err: any) {
		throw new Error(`Failed to parse JSON file at ${filePath}: ${err.message}`);
	}
}

/**
 * Parses tsconfig.json / jsconfig.json, recursively resolving relative extends.
 */
export function parseTsConfig(
	filePath: string,
	visited = new Set<string>()
): ParsedTsConfig {
	const absolutePath = normalizePath(path.resolve(filePath));
	if (visited.has(absolutePath)) {
		throw new Error(`Circular dependency detected in config extends: ${Array.from(visited).join(" -> ")} -> ${absolutePath}`);
	}

	visited.add(absolutePath);

	const baseDir = normalizePath(path.dirname(absolutePath));
	let rawConfig: any = {};
	try {
		rawConfig = readJsoncFile(absolutePath);
	} catch (err) {
		// If read fails (e.g. file doesn't exist), return default empty config
		return { baseDir };
	}

	const compilerOptions = rawConfig.compilerOptions || {};
	let baseUrl: string | undefined = undefined;
	if (compilerOptions.baseUrl) {
		baseUrl = normalizePath(path.resolve(baseDir, compilerOptions.baseUrl));
	}

	// Build absolute paths list from compilerOptions.paths
	const paths: Record<string, string[]> = {};
	if (compilerOptions.paths) {
		const pathKeys = Object.keys(compilerOptions.paths);
		for (const key of pathKeys) {
			const rawTargets = compilerOptions.paths[key];
			const targets = Array.isArray(rawTargets) ? rawTargets : [rawTargets];
			const resolvedTargets: string[] = [];
			for (const target of targets) {
				const resolveBase = baseUrl || baseDir;
				resolvedTargets.push(normalizePath(path.resolve(resolveBase, target)));
			}
			paths[key] = resolvedTargets;
		}
	}

	let mergedConfig: ParsedTsConfig = {
		baseDir,
		baseUrl,
		paths: Object.keys(paths).length > 0 ? paths : undefined
	};

	// Handle extends
	const extendsVal = rawConfig.extends;
	if (extendsVal && typeof extendsVal === "string") {
		// Only support relative extends for this slice
		const isRelative = extendsVal.startsWith("./") || extendsVal.startsWith("../");
		if (isRelative) {
			const extendedPath = normalizePath(path.resolve(baseDir, extendsVal));
			if (visited.has(extendedPath)) {
				throw new Error(`Circular dependency detected in config extends: ${Array.from(visited).join(" -> ")} -> ${extendedPath}`);
			}
			if (fs.existsSync(extendedPath)) {
				try {
					const parentConfig = parseTsConfig(extendedPath, visited);
					
					// Merge semantics: child overrides parent
					const mergedBaseUrl = mergedConfig.baseUrl !== undefined ? mergedConfig.baseUrl : parentConfig.baseUrl;
					
					const mergedPaths: Record<string, string[]> = {
						...(parentConfig.paths || {}),
						...(mergedConfig.paths || {})
					};

					mergedConfig = {
						baseDir,
						baseUrl: mergedBaseUrl,
						paths: Object.keys(mergedPaths).length > 0 ? mergedPaths : undefined
					};
				} catch (err: any) {
					if (err.message && err.message.includes("Circular dependency")) {
						throw err;
					}
					// Don't crash on other extended config parse failures (e.g. file content errors)
				}
			}
		}
	}

	visited.delete(absolutePath);
	return mergedConfig;
}
