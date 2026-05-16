import type { ProdexConfigFile } from "../types/config.types";

/**
 * Default configuration for Prodex.
 * Conforms strictly to ProdexConfig for full type safety.
 */
export const DEFAULT_PRODEX_CONFIG: ProdexConfigFile = {
	version: 3.1,
	$schema: "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
	output: {
		dir: "prodex",
		versioned: true,
		prefix: "combined",
		format: "md",
	},
	entry: {
		files: [],
	},
	resolve: {
		include: ["**/*.d.ts"],
		aliases: {
			"@": "resources/js",
		},
		exclude: ["node_modules/**", "@shadcn/**", "**/components/ui/**"],
		depth: 10,
		limit: 200,
	},

	shortcuts: {
		dashboard: {
			files: ["**/dashboard.tsx"],
			include: ["**.app.tsx", "**/*.d.ts"],
		},

		web: {
			files: ["**/web.php", "**/api.php"],
		},
	},
};
