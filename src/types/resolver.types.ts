import type { ProdexConfig } from "./config.types";
import type { DependencyOwnershipResult, OwnershipDiagnostic } from "../dependency/ownership/types";

export interface JsResolverCtx {
	kind: "js";
	aliases: Record<string, string>;
}

export interface PhpResolverCtx {
	kind: "php";
	psr4: Record<string, string | string[]>;
	nsKeys: string[];
	bindings: Record<string, string>;
}

export interface ResolverParams {
	cfg: ProdexConfig;
	filePath: string;
	ctx?: JsResolverCtx | PhpResolverCtx;
}

export interface ResolverResult {
	files: string[];
	stats: {
		expected: Set<string>;
		resolved: Set<string>;
	};
	ownership?: DependencyOwnershipResult[];
	diagnostics?: OwnershipDiagnostic[];
}
