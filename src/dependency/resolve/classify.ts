import path from "path";
import { normalizePath } from "../../filesystem/path";
import { WorkspaceIndex } from "../workspace";
import { ResolutionRequest } from "../request/types";
import { DebugCollector } from "../debug/collector";

export type SpecifierClassification =
	| { type: 'url'; specifier: string }
	| { type: 'dynamic'; specifier: string }
	| { type: 'external'; specifier: string }
	| { type: 'path'; specifier: string }
	| { type: 'bare'; specifier: string };

export function classifySpecifier(request: ResolutionRequest, debugCollector?: DebugCollector): SpecifierClassification {
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

	// 2.5 Special PHP require/include literal path handling
	const isPhpRequireInclude =
		request.sourceLanguage === 'php' &&
		(request.syntaxKind === 'require-literal' ||
		 request.syntaxKind === 'require-once-literal' ||
		 request.syntaxKind === 'include-literal' ||
		 request.syntaxKind === 'include-once-literal');

	if (isPhpRequireInclude) {
		const looksLikeFilePath = specifier.includes('/') || specifier.includes('\\') || specifier.endsWith('.php');
		if (looksLikeFilePath) {
			let normalizedSpec = specifier;
			if (
				!specifier.startsWith('./') &&
				!specifier.startsWith('../') &&
				!specifier.startsWith('/') &&
				!specifier.startsWith('\\') &&
				!/^[a-zA-Z]:[\\\/]/.test(specifier)
			) {
				normalizedSpec = './' + specifier;
			}
			return { type: 'path', specifier: normalizedSpec };
		}
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

		// Profile-driven check
		if (request.profile) {
			if (request.profile.bareBehavior === 'external') {
				return { type: 'external', specifier };
			}
			return { type: 'bare', specifier };
		}

		// compatibility/regression bridge fallback if profile is missing
		const isJsTsContext =
			request.sourceLanguage === 'javascript' ||
			request.sourceLanguage === 'typescript' ||
			request.syntaxKind === 'esm-import' ||
			request.syntaxKind === 'commonjs-require';

		if (isJsTsContext) {
			if (request.sourceLanguage) {
				debugCollector?.emit('resolve:classify:no-profile', {
					specifier,
					sourceLanguage: request.sourceLanguage
				}, `Missing profile for language ${request.sourceLanguage}, using compatibility bare-specifier classification`);
			}
			return { type: 'external', specifier };
		}

		if (request.sourceLanguage) {
			debugCollector?.emit('resolve:classify:no-profile', {
				specifier,
				sourceLanguage: request.sourceLanguage
			}, `Missing profile for language ${request.sourceLanguage}, using compatibility bare-specifier classification`);
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
