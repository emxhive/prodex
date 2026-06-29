import { SourcePosition } from "../types";
import { CaptureQuery } from "../query/types";

export interface ParsedDocument<TTree = unknown> {
	tree: TTree;
	sourceFile: string;
	sourceLanguage: string;
	source: string;
}

export interface CapturedNode<TNode = unknown> {
	patternName: string;        // matches CapturePattern.name
	text: string;               // raw text of the captured node
	node: TNode;                // opaque, adapter-specific AST node
	startPosition: SourcePosition;
	isDynamic: boolean;         // true if node is marked with dynamic-marker capture
}

export interface ParserAdapter<TTree = unknown, TNode = unknown> {
	readonly adapterId: string;
	readonly supportedLanguages: string[];

	/**
	 * Parse file content into an opaque tree.
	 * Returns null if the file cannot be parsed.
	 */
	parse(filePath: string, source: string, languageId: string): ParsedDocument<TTree> | null;

	/**
	 * Run CaptureQuery against the parsed document.
	 * Returns a list of captured nodes in source order.
	 */
	runQuery(doc: ParsedDocument<TTree>, query: CaptureQuery): CapturedNode<TNode>[];
}
