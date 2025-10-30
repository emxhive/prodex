import { runCombine } from "./core/combine";
import { initProdex } from "./cli/init";
import { logger } from "./lib/logger";
import { parseCliInput } from "./cli/cli-input";
import { loadProdexConfig } from "./constants/config-loader";
import "./lib/polyfills";

export default async function startProdex() {
	const args = process.argv;

	// Handle init mode
	if (args.includes("init")) {
		return initProdex();
	}

	// Parse CLI input
	const { root, flags, warnings, errors } = parseCliInput(args);

	if (warnings.length) logger.warn("Warnings:", warnings);
	if (errors.length) logger.error("Errors:", errors);

	// Load and merge configuration (with flag overrides)

	const config = await loadProdexConfig(flags, root);

	logger.log(`------- PRODEx RUN @ ${new Date().toLocaleTimeString()} — Codebase decoded -------`);
	// Log parse results for testing
	logger.debug("🧩 Parsed CLI input:", _2j({ flags }));
	logger.debug("Final merged config:", _2j(config));

	await runCombine(config, !flags.ci && !flags?.files?.length);
}
