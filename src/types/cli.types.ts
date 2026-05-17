export interface ProdexFlags {
	/** Entry globs or file paths. Repeatable and comma-aware. */
	entry?: string[];

	/** Extra files or globs appended without dependency resolution. */
	include?: string[];

	/** Files or globs to skip during traversal. */
	exclude?: string[];

	/** Output format override. */
	format?: "md" | "txt";

	/** Output basename override for this run. */
	name?: string | null;

	/** Maximum dependency traversal depth. */
	maxDepth?: number | null;

	/** Maximum number of files to trace. */
	maxFiles?: number | null;

	/** Enable debug logs. */
	debug?: boolean;

	/** Named profiles to run, in user-provided order. */
	profiles?: string[];

	/** Run all configured profiles. */
	allProfiles?: boolean;
}
