export interface LanguageProfile {
	languageId: string;              // canonical id: 'typescript', 'javascript', 'php', 'python', 'go', 'rust'
	extensions: string[];            // e.g. ['.ts', '.tsx']
	syntaxKinds: string[];           // the syntaxKind values this language can emit
	preferredAdapterId: string;      // maps to a registered ParserAdapter
	bareBehavior?: 'external' | 'unresolvable';
	extensionPriorityGroups?: string[][];
	sourceEquivMap?: Record<string, string[]>;
}

export interface DetectionResult {
	languageId: string;
	profile: LanguageProfile;
	confidence: 'high' | 'low';
	method: 'extension' | 'shebang' | 'heuristic' | 'default';
}
