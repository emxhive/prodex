import { CODE_EXTS } from "../legacy/resolvers/resolver-constants";
import { resolveJsImports } from "../legacy/resolvers/js/js-resolver";
import { resolvePhpImports } from "../legacy/resolvers/php/php-resolver";
import type { ResolverParams, ResolverResult } from "../types";

type Resolver = (params: ResolverParams) => Promise<ResolverResult>;

const RESOLVERS: Partial<Record<string, Resolver>> = {
	".php": resolvePhpImports,
	".ts": resolveJsImports,
	".tsx": resolveJsImports,
	".d.ts": resolveJsImports,
	".js": resolveJsImports,
};

export function hasResolver(extension: string): boolean {
	return CODE_EXTS.includes(extension) && !!RESOLVERS[extension];
}

export function getResolver(extension: string): Resolver | undefined {
	return RESOLVERS[extension];
}
