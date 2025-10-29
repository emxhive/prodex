import { runCombine } from "./core/combine";
import { initProdex } from "./cli/init";
import { logger } from "./lib/logger";
import { parseCliInput } from "./cli/cli-input";
import { loadProdexConfig } from "./constants/config-loader";

export default async function startProdex() {
  const args = process.argv.slice(2);

  // Handle init mode
  if (args.includes("init")) {
    return initProdex();
  }

  // Parse CLI input
  const { entries, flags, warnings, errors } = parseCliInput(args);
  console.clear();

  // Log parse results for testing
  logger.log("\n🧩 Parsed CLI input:");
  logger.log({ entries, flags });
  if (warnings.length) logger.warn("Warnings:", warnings);
  if (errors.length) logger.error("Errors:", errors);

  // Load and merge configuration (with flag overrides)
  const config = await loadProdexConfig(flags);

  logger.log(`\n----- PRODEx RUN @ ${new Date().toLocaleTimeString()} — Codebase decoded -----\n`);
  logger.log("Final merged config:", config);

  // 🔸 For now, only logging; will pass to runCombine later
  logger.log("\n✅ Ready to combine with:");
  logger.log({ entries, flags,  });
}
