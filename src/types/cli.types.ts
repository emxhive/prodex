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
	depth?: number | null;

	/** Maximum number of files to trace. */
	maxFiles?: number | null;

	/** Enable debug logs. */
	debug?: boolean;

	/** Scopes to merge for pack command. */
	scope?: string[];

	/** Keys of scopes to run for scope command. */
	key?: string[];

	/** Run all scopes for scope command. */
	all?: boolean;

	/** List available scopes. */
	list?: boolean;

	/** Perform a dry-run execution. */
	dryRun?: boolean;

	/** Deprecated legacy flags */
	profile?: string[];
	allProfiles?: boolean;
	maxDepth?: number | null;
}
