import { initProdex } from "./cli/init";
import { parseCliInput } from "./cli/cli-input";
import { ConfigManager } from "./core/managers/config";
import { setGlobals } from "./store";
import { runCombine } from "./core/combine";

export default async function startProdex(args = process.argv) {
	if (args.includes("init")) return initProdex();

	const { root, flags } = parseCliInput(args);
	const userConfig = ConfigManager.load(root);
	const config = ConfigManager.merge(userConfig, flags, root);
	setGlobals(config, flags);

	const opts = {
		showUi: !flags.ci && !flags?.files?.length && !config?.entry?.ui?.enablePicker,
		cliName: config.name,
	};

	await import("./lib/polyfills");
	await runCombine({ cfg: config, opts });
}
