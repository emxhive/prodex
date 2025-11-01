import { runCombine } from "./core/combine";
import { initProdex } from "./cli/init";
import { parseCliInput } from "./cli/cli-input";
import { loadProdexConfig } from "./constants/config-loader";
import "./lib/polyfills";
import { introSummary } from "./cli/summary";

export default async function startProdex() {
	const args = process.argv;

	// Handle init mode
	if (args.includes("init")) {
		return initProdex();
	}

	// Parse CLI input
	const { root, flags } = parseCliInput(args);

	// Load and merge configuration (with flag overrides)
	const config = await loadProdexConfig(flags, root);
	introSummary({ flags, config });

	const opts = {
		showUi: !flags.ci && !flags?.files?.length && !config?.entry?.ui?.enablePicker,
		cliName: config.name,
	};

	await runCombine({ cfg: config, opts });
}
