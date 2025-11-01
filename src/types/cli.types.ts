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

	/** Headless / non-interactive mode (-c / --ci) */
	ci?: boolean;

	/** Enable debug logs (-d / --debug) */
	debug?: boolean;

	/** Verbose logs (-v / --verbose) */
	verbose?: boolean;

	/** Custom output filename (without extension) (--name / -n) */
	name?: string | null;

	/** Traversal limit override (--limit / -l) */
	limit?: number | null;

	/** Comma-separated glob list overriding resolve.include (--inc) */
	include?: string[];

	/** Comma-separated glob list overriding resolve.exclude (--exc) */
	exclude?: string[];
	files?: string[];

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
