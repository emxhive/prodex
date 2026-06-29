import { ParserAdapter, ParsedDocument, CapturedNode } from "./types";
import { CaptureQuery } from "../query/types";

export class NullParserAdapter implements ParserAdapter {
	readonly adapterId = 'null';
	readonly supportedLanguages: string[];

	constructor(supportedLanguages: string[] = []) {
		this.supportedLanguages = supportedLanguages;
	}

	parse(_filePath: string, _source: string, _languageId: string): ParsedDocument<unknown> | null {
		return null;
	}

	runQuery(_doc: ParsedDocument<unknown>, _query: CaptureQuery): CapturedNode<unknown>[] {
		return [];
	}
}
