import path from "path";
import { normalizePath } from "../../filesystem/path";
import { WorkspaceIndex } from "../workspace";
import { ResolutionRequest } from "../request/types";
import { DebugCollector } from "../debug/collector";
import { ReferenceSemantics } from "../types/reference-semantics";

export type SpecifierClassification =
	| { type: 'url'; specifier: string }
	| { type: 'dynamic'; specifier: string }
	| { type: 'external'; specifier: string }
	| { type: 'path'; specifier: string }
	| { type: 'bare'; specifier: string };

function translateSemantics(semantics: ReferenceSemantics, specifier: string): SpecifierClassification {
	if (semantics.domain === 'file') {
		if (semantics.resolution === 'absolute') {
			return { type: 'path', specifier };
		}
		if (semantics.resolution === 'relative') {
			if (semantics.anchor === 'runtime') {
				return { type: 'bare', specifier };
			}
			return { type: 'path', specifier };
		}
		if (semantics.resolution === 'search') {
			return { type: 'bare', specifier };
		}
	}
	if (semantics.domain === 'uri') {
		return { type: 'url', specifier };
	}
	if (semantics.domain === 'module') {
		if (semantics.resolution === 'relative') {
			return { type: 'path', specifier };
		}
		if (semantics.resolution === 'absolute') {
			return { type: 'path', specifier };
		}
		return { type: 'bare', specifier };
	}
	if (semantics.domain === 'symbol') {
		return { type: 'bare', specifier };
	}
	return { type: 'bare', specifier };
}

/**
 * Returns true only for the four semantic combinations that are eligible for
 * static path resolution:
 *   file  + absolute
 *   file  + relative + source
 *   module + absolute
 *   module + relative + source
 *
 * Explicitly not eligible (returns false):
 *   file  + relative + runtime   (PHP runtime-relative, not resolved statically)
 *   file  + search               (include_path search, not path-addressed)
 *   module + logical             (package name, not path-addressed)
 *   uri   + *                    (any URI domain)
 *   symbol + *                   (any symbol domain)
 *
 * Returns undefined when no semantics are present (caller uses its own
 * compatibility path and must not be blocked by this predicate).
 */
export function isStaticPathEligible(request: ResolutionRequest): boolean | undefined {
	const semantics = request.semantics;
	if (!semantics) return undefined;

	if (semantics.domain === 'file') {
		if (semantics.resolution === 'absolute') return true;
		if (semantics.resolution === 'relative') {
			return semantics.anchor === 'source';
		}
		return false; // search
	}

	if (semantics.domain === 'module') {
		if (semantics.resolution === 'absolute') return true;
		if (semantics.resolution === 'relative') {
			return semantics.anchor === 'source';
		}
		return false; // logical
	}

	// uri, symbol — not eligible
	return false;
}

export function classifySpecifier(request: ResolutionRequest, debugCollector?: DebugCollector): SpecifierClassification {
	const specifier = request.specifier.trim();

	if (request.semantics) {
		return translateSemantics(request.semantics, specifier);
	}

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
