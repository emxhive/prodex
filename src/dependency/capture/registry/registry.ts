import { ParserRegistry } from "./types";
import { ParserAdapter } from "../adapter/types";

export class DefaultParserRegistry implements ParserRegistry {
	private adapters = new Map<string, ParserAdapter>();
	private languageToAdapter = new Map<string, string>();

	register(adapter: ParserAdapter): void {
		if (this.adapters.has(adapter.adapterId)) {
			throw new Error(`ParserAdapter with id "${adapter.adapterId}" is already registered.`);
		}
		this.adapters.set(adapter.adapterId, adapter);
		for (const lang of adapter.supportedLanguages) {
			this.languageToAdapter.set(lang, adapter.adapterId);
		}
	}

	resolve(languageId: string): ParserAdapter | null {
		const adapterId = this.languageToAdapter.get(languageId);
		if (!adapterId) {
			return null;
		}
		return this.adapters.get(adapterId) || null;
	}

	listAdapterIds(): string[] {
		return Array.from(this.adapters.keys());
	}
}
