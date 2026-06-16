import type { ProdexConfigFile } from "../types/config.types";

export const DEFAULT_PRODEX_CONFIG: ProdexConfigFile = {
	version: 5,
	$schema: "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
	output: {
		dir: "prodex",
		versioned: true,
		format: "md",
	},
	exclude: ["node_modules/**", "vendor/**", "dist/**", "@shadcn/**", "**/components/ui/**"],
	aliases: {
		"@": "resources/js",
	},
	depth: 2,
	maxFiles: 200,
	scopes: {},
};
