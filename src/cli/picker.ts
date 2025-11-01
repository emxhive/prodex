import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import { walk, rel, orderByPriority } from "../core/helpers";
import { globScan } from "../core/file-utils";
import { unique } from "../lib/utils";
import { logger } from "../lib/logger";
import { prompt } from "../lib/prompt";
import type { QuestionSet, ProdexConfig } from "../types";
import { PICK_ENTRIES_QUESTION } from "../lib/questions";

/**
 * Interactive entry picker for Prodex.
 * Handles depth-based scanning, caching, and priority ordering.
 */
export async function pickEntries(cfg: ProdexConfig) {
	const {
		root,
		entry: {
			files,
			ui: { roots = [], priority = [], scanDepth },
		},
	} = cfg;

	let depth = scanDepth;
	const entryPatterns = files || [];
	const priorities = [...entryPatterns, ...priority];

	// 1️⃣ Resolve pre-defined entry patterns
	const resolvedEntries = (await globScan(entryPatterns, { cwd: root })).files;
	let selected = [...resolvedEntries];

	// cache: depth → files[]
	const scanCache = new Map<number, string[]>();

	for (;;) {
		const files = await getFilesAtDepth(depth, cfg, scanCache);

		// Merge resolved entries with current scan results
		const combined = unique([...resolvedEntries, ...files]);
		const sorted = orderByPriority(combined, priorities);

		// Build UI selection list
		const choices = sorted.map((f) => ({
			name: rel(f, root),
			value: f,
			checked: selected.includes(f),
		}));

		if (depth < scanDepth + 5) {
			choices.push(new inquirer.Separator());
			choices.push({ name: "🔽 Load more (go deeper)", value: "__loadmore" });
		}

		// 🧠 Use unified prompt wrapper
		const answers = await prompt(PICK_ENTRIES_QUESTION(choices, depth), { picks: [] });
		if (!answers) return unique(selected);

		const { picks } = answers;

		if (picks.includes("__loadmore")) {
			depth++;
			selected = picks.filter((p) => p !== "__loadmore");
			continue;
		}

		selected = picks.filter((p) => p !== "__loadmore");
		break;
	}

	return unique(selected);
}

/**
 * Depth-based directory scanner with caching.
 */
async function getFilesAtDepth(depth: number, cfg: ProdexConfig, scanCache: Map<number, string[]>) {
	const baseDirs = cfg.entry.ui.roots || [];
	if (scanCache.has(depth)) {
		logger.debug(`[picker] cache hit → depth=${depth}`);
		return scanCache.get(depth)!;
	}

	logger.debug(`[picker] scanning → depth=${depth}`);

	const files: string[] = [];
	const effectiveCfg = { ...cfg, scanDepth: depth };

	for (const base of baseDirs) {
		const full = path.join(cfg.root, base);
		if (!fs.existsSync(full)) continue;
		for (const f of walk(full, effectiveCfg, 0)) files.push(f.norm());
	}

	scanCache.set(depth, files);
	logger.debug(`[picker] depth=${depth} found=${files.length}`);
	return files;
}
