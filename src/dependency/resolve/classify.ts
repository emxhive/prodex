import path from "path";
import { normalizePath } from "../../filesystem/path";
import { WorkspaceIndex } from "../workspace";
import { ResolutionRequest } from "../request/types";

export type SpecifierClassification =
	| { type: 'url'; specifier: string }
	| { type: 'dynamic'; specifier: string }
	| { type: 'external'; specifier: string }
	| { type: 'path'; specifier: string }
	| { type: 'bare'; specifier: string };

export function classifySpecifier(request: ResolutionRequest): SpecifierClassification {
	const specifier = request.specifier.trim();

	// 1. URL imports (starts with http://, https://, ftp://, file://)
	if (/^(https?|ftp|file):\/\//.test(specifier)) {
		return { type: 'url', specifier };
	}

	// 2. Dynamic cases (intentionally unsupported dynamic paths or variable-based imports)
	const isDynamic =
		specifier.includes('${') ||
		specifier.includes('import_module(') ||
		(specifier.startsWith('require(') && !specifier.match(/^require\(['"][^'"]+['"]\)$/)) ||
		/\$\w+/.test(specifier); // Match PHP require $path or variable like $path

	if (isDynamic) {
		return { type: 'dynamic', specifier };
	}

	// 3. Path specifiers (relative or absolute)
	const isPath =
		specifier.startsWith('./') ||
		specifier.startsWith('../') ||
		specifier.startsWith('/') ||
		specifier.startsWith('\\') ||
		/^[a-zA-Z]:[\\\/]/.test(specifier); // Windows absolute paths

	if (isPath) {
		return { type: 'path', specifier };
	}

	// 4. Conservative External Checking under dependency-edge intent
	if (request.intent === 'dependency-edge') {
		const isJsTsContext =
			request.sourceLanguage === 'javascript' ||
			request.sourceLanguage === 'typescript' ||
			request.syntaxKind === 'esm-import' ||
			request.syntaxKind === 'commonjs-require';

		// node: specifier is always external
		if (specifier.startsWith('node:')) {
			return { type: 'external', specifier };
		}

		// Node/TS private imports starting with '#' - do not classify as external
		if (specifier.startsWith('#')) {
			return { type: 'bare', specifier };
		}

		// TypeScript path alias like '@/helper' or '~/config' - do not classify as external
		if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
			return { type: 'bare', specifier };
		}

		// PHP Namespace check (contains backslash) - not external
		if (specifier.includes('\\')) {
			return { type: 'bare', specifier };
		}

		// Rust namespace check (contains ::) - not external
		if (specifier.includes('::')) {
			return { type: 'bare', specifier };
		}

		// Python standard libraries when in python context
		if (request.sourceLanguage === 'python') {
			const pyBuiltins = new Set([
				'sys', 'os', 'json', 'math', 're', 'datetime', 'time', 'urllib', 'hashlib', 'collections', 'itertools'
			]);
			if (pyBuiltins.has(specifier)) {
				return { type: 'external', specifier };
			}
			return { type: 'bare', specifier };
		}

		// Go modules / paths - do not classify as external
		if (request.sourceLanguage === 'go') {
			return { type: 'bare', specifier };
		}

		// Obvious JS/TS packages (like lodash, react, fs, path, etc.) under JS/TS context
		if (isJsTsContext) {
			return { type: 'external', specifier };
		}

		// If no context is provided or context doesn't match standard package rules, do not guess
		return { type: 'bare', specifier };
	}

	// Default to bare terms (seed targets / stems / basenames)
	return { type: 'bare', specifier };
}

export function resolveRequestBasePath(request: ResolutionRequest, index: WorkspaceIndex): string | undefined {
	if (request.origin?.path) {
		const p = request.origin.path;
		return normalizePath(path.isAbsolute(p) ? p : path.resolve(index.root, p));
	}
	if (request.sourceFile) {
		const p = request.sourceFile;
		return normalizePath(path.isAbsolute(p) ? p : path.resolve(index.root, p));
	}
	return undefined;
}
