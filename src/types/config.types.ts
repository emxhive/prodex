/**
 * Canonical configuration interface for Prodex.
 * Defines the accepted and guaranteed structure at runtime.
 */
export interface ProdexConfig extends ProdexBase {
	name: string;
	root: string;
}

/** Optional helper for typed schema versions. */
export interface Versioned {
	version: ProdexConfig["version"];
}

/** Represents the user-saved config file (without runtime fields). */
export type ProdexConfigFile = ProdexBase;

export type DeepPartial<T> = {
	[K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type ProdexShortcut = {
	prefix?: string;
	files?: string[];
	include?: string[];
	exclude?: string[];
};
interface ProdexBase {
	version: number;

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
		include: string[];
		aliases: Record<string, string>;
		exclude: string[];
		depth: number;
		limit: number;
	};

	shortcuts: Record<string, ProdexShortcut>;
}
