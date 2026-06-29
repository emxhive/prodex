import { CaptureQuery } from "./types";

export interface CaptureQueryRegistry {
	register(query: CaptureQuery): void;
	resolve(languageId: string): CaptureQuery | null;
	listLanguageIds(): string[];
}

export class DefaultCaptureQueryRegistry implements CaptureQueryRegistry {
	private queries = new Map<string, CaptureQuery>();

	register(query: CaptureQuery): void {
		if (this.queries.has(query.languageId)) {
			throw new Error(`CaptureQuery for language "${query.languageId}" is already registered.`);
		}
		this.queries.set(query.languageId, query);
	}

	resolve(languageId: string): CaptureQuery | null {
		return this.queries.get(languageId) || null;
	}

	listLanguageIds(): string[] {
		return Array.from(this.queries.keys());
	}
}
