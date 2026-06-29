import { Parser, Language, Query, Tree } from "web-tree-sitter";
import { ParserAdapter, ParsedDocument, CapturedNode } from "../types";
import { CaptureQuery } from "../../query/types";

export class TreeSitterParserAdapter implements ParserAdapter<unknown, unknown> {
	readonly adapterId = "tree-sitter";
	readonly supportedLanguages = ["javascript", "php"];

	private parser: Parser;
	private languages = new Map<string, Language>();

	private constructor(parser: Parser) {
		this.parser = parser;
	}

	/**
	 * Async factory method to create and initialize the Tree-sitter adapter.
	 * Loads the Wasm parser and the specified language grammars.
	 */
	static async create(wasmPaths: Record<string, string>): Promise<TreeSitterParserAdapter> {
		await Parser.init();
		const parser = new Parser();
		const adapter = new TreeSitterParserAdapter(parser);

		for (const [langId, wasmPath] of Object.entries(wasmPaths)) {
			const lang = await Language.load(wasmPath);
			adapter.languages.set(langId, lang);
		}

		return adapter;
	}

	parse(filePath: string, source: string, languageId: string): ParsedDocument<unknown> | null {
		const lang = this.languages.get(languageId);
		if (!lang) {
			return null;
		}

		this.parser.setLanguage(lang);
		const tree = this.parser.parse(source);
		if (!tree) {
			return null;
		}

		return {
			tree,
			sourceFile: filePath,
			sourceLanguage: languageId,
			source,
			hasErrors: tree.rootNode.hasError
		};
	}

	runQuery(doc: ParsedDocument<unknown>, query: CaptureQuery): CapturedNode<unknown>[] {
		const lang = this.languages.get(doc.sourceLanguage);
		if (!lang) {
			return [];
		}

		if (!query.rawQuery) {
			return [];
		}

		let tsQuery: Query;
		try {
			tsQuery = new Query(lang, query.rawQuery);
		} catch (err) {
			return [];
		}

		const tree = doc.tree as Tree;
		const captures = tsQuery.captures(tree.rootNode);

		return captures.map(capture => {
			const node = capture.node;
			return {
				patternName: capture.name,
				text: node.text,
				node: node,
				startPosition: {
					line: node.startPosition.row + 1,
					column: node.startPosition.column
				},
				isDynamic: false
			};
		});
	}
}
