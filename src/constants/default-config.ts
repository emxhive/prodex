import type { ProdexConfig, ProdexConfigFile } from "../types/config.types";

/**
 * Default configuration for Prodex.
 * Conforms strictly to ProdexConfig for full type safety.
 */
export const DEFAULT_PRODEX_CONFIG: ProdexConfigFile = {
	version: 3.1,
	output: {
		dir: "prodex",
		versioned: true,
		prefix: "combined",
		format: "md",
	},
	entry: {
		files: [],
		ui: {
			roots: ["app", "routes", "resources/js/**"],
			scanDepth: 2,
			priority: ["**/routes/web.php", "**/routes/api.php", "**/*index.*", "**/*main.*", "**/app.*"],
		},
	},
	resolve: {
		include: ["**/*.d.ts", "**/*.interface.ts"],
		aliases: {
			"@hooks": "resources/js/hooks",
			"@data": "resources/js/data",
		},
		exclude: ["node_modules/**", "@shadcn/**", "**/components/ui/**"],
		depth: 10,
		limit: 200,
	},
};
