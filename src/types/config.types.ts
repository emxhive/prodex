export interface ProdexConfig extends ProdexBase {
	root: string;
	name?: string;
}

export type ProdexConfigFile = DeepPartial<ProdexBase> & {
	$schema: string;
	version: number;
};

export type DeepPartial<T> = {
	[K in keyof T]?: T[K] extends Array<infer Item>
		? Item[]
		: T[K] extends object
			? DeepPartial<T[K]>
			: T[K];
};

export type ProdexProfile = {
	name?: string;
	entry?: string[];
	include?: string[];
	exclude?: string[];
};

interface ProdexBase {
	output: {
		dir: string;
		versioned: boolean;
		format: "md" | "txt";
	};

	entry: string[];
	include: string[];
	exclude: string[];

	resolve: {
		aliases: Record<string, string>;
		maxDepth: number;
		maxFiles: number;
	};

	profiles: Record<string, ProdexProfile>;
}
