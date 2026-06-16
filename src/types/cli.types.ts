export interface ProdexFlags {
	/** Entry globs or file paths. Repeatable and comma-aware. */
	entry?: string[];

	/** Target file/module to resolve and trace from. Repeatable and comma-aware. */
	target?: string[];

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

	/** Sequential attached shell commands to execute. */
	cmd?: string[];

	/** Per-command timeout in seconds. */
	cmdTimeout?: number | null;

	/** Enforce strict mode, exiting nonzero if any command fails. */
	failOnCmdError?: boolean;

	/** Git-specific: Include staged, unstaged, and untracked changes. */
	changed?: boolean;

	/** Git-specific: Include staged changes only. */
	staged?: boolean;

	/** Git-specific: Include unstaged changes only. */
	unstaged?: boolean;

	/** Git-specific: Include untracked files only. */
	untracked?: boolean;

	/** Git-specific: Include full git diff output in generic sections. */
	includeDiff?: boolean;

	/** Deprecated legacy flags */
	profile?: string[];
	allProfiles?: boolean;
	maxDepth?: number | null;
}
