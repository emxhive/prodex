import { initProdex } from "./cli/init";
import { parseCliInput } from "./cli/cli-input";
import { ConfigManager } from "./core/managers/config";
import { setGlobals } from "./store";
import { runCombine } from "./core/combine";

export default async function startProdex(args = process.argv) {
	if (args.includes("init")) return initProdex();

	const { root, flags } = parseCliInput(args);
	const userConfig = ConfigManager.load(root);

	// Determine which shortcut runs to execute (order irrelevant).
	const selected: string[] = [];
	if (flags.shortcutAll) {
		selected.push(...Object.keys(userConfig.shortcuts ?? {}));
	} else if (Array.isArray(flags.shortcuts) && flags.shortcuts.length) {
		selected.push(...flags.shortcuts);
	} else if (flags.shortcut) {
		selected.push(flags.shortcut);
	}

	const shortcutRuns = Array.from(
		new Set(selected.map((s) => String(s).trim()).filter(Boolean)),
	).sort();

	await import("./lib/polyfills");

	// Multi-run mode (shortcuts)
	if (shortcutRuns.length) {
		for (const shortcut of shortcutRuns) {
			const runFlags = {
				...flags,
				shortcut,
				shortcuts: undefined,
				shortcutAll: false,
			};

			const config = ConfigManager.merge(userConfig, runFlags, root);
			setGlobals(config, runFlags);

			const opts = {
				showUi: false,
				// Avoid output collisions when running multiple shortcuts.
				cliName: config.name ?? shortcut,
			};

			await runCombine({ cfg: config, opts });
		}
		return;
	}

	// If "@" was used but no shortcuts exist, fall back to a normal single run.
	const baseFlags = flags.shortcutAll ? { ...flags, shortcutAll: false } : flags;

	const config = ConfigManager.merge(userConfig, baseFlags, root);
	setGlobals(config, baseFlags);

	const opts = {
		showUi:
			!baseFlags.ci &&
			!baseFlags?.files?.length &&
			config?.entry?.ui?.enablePicker &&
			!baseFlags.shortcut &&
			!baseFlags.shortcuts?.length &&
			!baseFlags.shortcutAll,
		cliName: config.name,
	};

	await runCombine({ cfg: config, opts });
}
