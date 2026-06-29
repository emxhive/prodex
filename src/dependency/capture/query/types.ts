export interface CapturePattern {
	name: string;         // e.g. 'import.source', 'require.argument'
	role: 'specifier' | 'dynamic-marker' | 'namespace' | 'alias';
}

export interface CaptureQuery {
	languageId: string;
	adapterId: string;
	patterns: CapturePattern[];
	rawQuery?: string;    // Raw query format (e.g. tree-sitter query S-expression)
}
