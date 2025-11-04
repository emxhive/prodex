import { initProdex } from "./cli/init";
import { parseCliInput } from "./cli/cli-input";
import { loadProdexConfig } from "./constants/config-loader";
import { setGlobals } from "./store";
import { runCombine } from "./core/combine";

export default async function startProdex(args = process.argv) {
	// Handle init mode
	if (args.includes("init")) {
		return initProdex();
	}

	// Parse CLI input
	const { root, flags } = parseCliInput(args);

	// Load and merge configuration (with flag overrides)
	const config = await loadProdexConfig(flags, root);
	setGlobals(config, flags);

	const opts = {
		showUi: !flags.ci && !flags?.files?.length && !config?.entry?.ui?.enablePicker,
		cliName: config.name,
	};

	await import("./lib/polyfills");

	await runCombine({ cfg: config, opts });
}
