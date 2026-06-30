import { CODE_EXTS } from "../legacy/resolvers/resolver-constants";
import { resolveJsImports } from "../legacy/resolvers/js/js-resolver";
import { resolveUniversalImports } from "./resolver-bridge";
import type { ResolverParams, ResolverResult } from "../types";

type Resolver = (params: ResolverParams) => Promise<ResolverResult>;

const RESOLVERS: Partial<Record<string, Resolver>> = {
	".php": resolveUniversalImports,
	".ts": resolveJsImports,
	".tsx": resolveJsImports,
	".d.ts": resolveJsImports,
	".js": resolveUniversalImports,
	".mjs": resolveUniversalImports,
	".cjs": resolveUniversalImports,
};

export function hasResolver(extension: string): boolean {
	return CODE_EXTS.includes(extension) && !!RESOLVERS[extension];
}

export function getResolver(extension: string): Resolver | undefined {
	return RESOLVERS[extension];
}
