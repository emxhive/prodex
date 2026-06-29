export type EdgeKind =
	| 'import'
	| 'require'
	| 'include'
	| 'use'
	| 'reference'
	| 'dynamic';

export interface SourcePosition {
	line: number;       // 1-based
	column: number;     // 0-based
}

export interface DynamicEdgeHint {
	pattern?: string;   // template pattern if partially known, e.g. `./routes/${name}`
	reason: string;     // why it is considered dynamic
}

export interface DependencyEdge {
	specifier: string;           // raw string as it appears in source
	kind: EdgeKind;
	sourceFile: string;          // absolute path of the containing file
	sourceLanguage: string;      // language id, e.g. 'typescript', 'php', 'python'
	syntaxKind?: string;         // fine-grained syntax label, e.g. 'esm-import', 'commonjs-require'
	position?: SourcePosition;   // location of the import statement
	isDynamic?: boolean;         // true if the specifier is not statically known
	dynamicHint?: DynamicEdgeHint;
}

export interface CaptureResult {
	sourceFile: string;
	sourceLanguage: string;
	edges: DependencyEdge[];
	parseError?: string;  // present only if the parser failed; edges may be partial
	namespaceContext?: string;
}
