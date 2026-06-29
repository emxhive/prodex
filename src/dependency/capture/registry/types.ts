import { ParserAdapter } from "../adapter/types";

export interface ParserRegistry {
	/**
	 * Register a ParserAdapter under its adapterId.
	 * Throws if an adapter with the same id is already registered.
	 */
	register(adapter: ParserAdapter): void;

	/**
	 * Look up the best adapter for a given languageId.
	 * Returns null if no adapter is registered for that language.
	 */
	resolve(languageId: string): ParserAdapter | null;

	/**
	 * List all registered adapter ids (for diagnostics).
	 */
	listAdapterIds(): string[];
}
