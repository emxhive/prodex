/**
 * Canonical configuration interface for Prodex.
 * Defines the accepted and guaranteed structure at runtime.
 */
export interface ProdexConfig extends ProdexBase {
	name: string;
	root: string;
}

/** Represents the user-saved config file (without runtime fields). */
export type ProdexConfigFile = DeepPartial<ProdexBase> & {
	$schema: string;
	version: number;
};

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
	output: {
		dir: string;
		versioned: boolean;
		prefix: string;
		format: "md" | "txt";
	};

	entry: {
		files: string[];
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
