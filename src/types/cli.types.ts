/**
 * CLI flag schema for Prodex.
 * Mirrors the current CLI synopsis:
 *
 *   prodex [entries...] [-tcdv]
 *          [--txt] [--ci] [--debug] [--verbose]
 *          [--name=<string>|-n=<string>]
 *          [--limit=<int>|-l=<int>]
 *          [--inc=<globs>] [--exc=<globs>]
 */

export interface ProdexFlags {
	_: string[];
	/** Output as .txt instead of .md (-t / --txt) */
	txt?: boolean;

	/** Disable UI picker and run headless (-c / --ci) */
	ci?: boolean;

	/** Enable debug logs (-d / --debug) */
	debug?: boolean;

	/** Enable verbose logging (-v / --verbose) */
	verbose?: boolean;

	/** Output name override (--name / -n) */
	name?: string | null;

	/** Traversal limit override (--limit / -l) */
	limit?: number | null;

	/** Comma-separated glob list overriding resolve.include (--inc) */
	include?: string[];

	/** Comma-separated glob list overriding resolve.exclude (--exc) */
	exclude?: string[];
	files?: string[];

	/** Single shortcut name (legacy / --shortcut) */
	shortcut?: string;

	/** Multiple shortcuts via @a @b @c (order irrelevant) */
	shortcuts?: string[];

	/** Run all shortcuts via @ */
	shortcutAll?: boolean;

	/** Optional short alias reference mapping */
	short?: {
		t?: boolean;
		c?: boolean;
		d?: boolean;
		v?: boolean;
		n?: string;
		l?: number;
	};
}

/** Minimal run summary for logging and UX display. */
export interface CliSummary {
	outDir: string;
	fileName: string;
	entries: string[];
}

export interface ParsedInput {
	rootArg: string;
	root?: string;
	flags: Partial<ProdexFlags>;
}
