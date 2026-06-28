export type ResolutionIntent = 'seed-target' | 'seed-entry' | 'dependency-edge';

export type ResolutionStatus =
	| 'resolved'
	| 'resolved-set'
	| 'ambiguous'
	| 'external'
	| 'unresolved'
	| 'blocked';

export type StrategyLevel =
	| 'L1'
	| 'L2'
	| 'L3'
	| 'L3.5'
	| 'L4'
	| 'L5'
	| 'L6'
	| 'L7'
	| 'L8'
	| 'L9'
	| 'L10'
	| 'LX';

export interface ResolutionOrigin {
	path?: string;
	position?: {
		line: number;
		column: number;
	};
}

export interface ResolutionRequest {
	specifier: string;
	intent: ResolutionIntent;
	origin?: ResolutionOrigin;
	sourceFile?: string;
	sourceLanguage?: string;
	syntaxKind?: string;
}

export interface ResolutionResult {
	status: ResolutionStatus;
	level?: StrategyLevel;
	strategy?: string;
	confidence?: 'high' | 'medium' | 'low';
	file?: string;
	files?: string[];
	candidates?: string[];
	reason?: string;
	attempted?: string[];
	follow?: boolean;
}
