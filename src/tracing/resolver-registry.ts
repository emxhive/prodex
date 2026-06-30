import { resolveUniversalImports } from "./resolver-bridge";
import type { ResolverParams, ResolverResult } from "../types";

type Resolver = (params: ResolverParams) => Promise<ResolverResult>;

const RESOLVERS: Record<string, Resolver> = {
	".php": resolveUniversalImports,
	".js": resolveUniversalImports,
	".mjs": resolveUniversalImports,
	".cjs": resolveUniversalImports,
	".ts": resolveUniversalImports,
	".tsx": resolveUniversalImports,
	".d.ts": resolveUniversalImports,
};

export function hasResolver(extension: string): boolean {
	return extension in RESOLVERS;
}

export function getResolver(extension: string): Resolver | undefined {
	return RESOLVERS[extension];
}
