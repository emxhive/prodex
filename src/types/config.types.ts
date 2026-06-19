export interface ProdexConfig {
	root: string;
	name?: string;
	dryRun?: boolean;
	output: {
		dir: string;
		versioned: boolean;
		format: "md" | "txt";
	};
	entry: string[];
	include: string[];
	exclude: string[];
	aliases: Record<string, string>;
	depth: number;
	maxFiles: number;
	scopes: Record<string, ProdexScope>;
}

export interface ProdexConfigFileOutput {
	dir?: string;
	versioned?: boolean;
	format?: "md" | "txt";
}

export type ProdexConfigFile = {
	$schema: string;
	version: number;
	output?: ProdexConfigFileOutput;
	exclude?: string[];
	aliases?: Record<string, string>;
	depth?: number;
	maxFiles?: number;
	scopes?: Record<string, ProdexScope>;
};

export type DeepPartial<T> = {
	[K in keyof T]?: T[K] extends Array<infer Item>
		? Item[]
		: T[K] extends object
			? DeepPartial<T[K]>
			: T[K];
};

export type ProdexScope = {
	name?: string;
	entry?: string[];
	include?: string[];
	exclude?: string[];
};

