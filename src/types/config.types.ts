/**
 * Canonical configuration interface for Prodex.
 * Defines the accepted and guaranteed structure at runtime.
 */
export interface ProdexConfig {
	version: number;
	root: string;
	output: {
		dir: string;
		versioned: boolean;
		prefix: string;
		format: "md" | "txt";
	};

	entry: {
		files: string[];
		ui: {
			roots: string[];
			scanDepth: number;
			priority: string[];
			enablePicker?: boolean;
		};
	};

	resolve: {
		includes: string[];
		aliases: Record<string, string>;
		excludes: string[];
		depth: number;
		limit: number;
	};

	debug: {
		verbose: boolean;
		showSummary: boolean;
	};
}

/** Optional helper for typed schema versions. */
export interface Versioned {
	version: ProdexConfig["version"];
}

/** Represents the user-saved config file (without runtime fields). */
export type ProdexConfigFile = Omit<ProdexConfig, "root">;
