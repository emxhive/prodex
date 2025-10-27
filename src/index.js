import { runCombine } from "./core/combine.js";
import { initProdex } from "./cli/init.js";

export default async function startProdex() {
  const args = process.argv.slice(2);
  if (args.includes("init")) return await initProdex();

  const entryArgs = args.filter(a => !a.startsWith("--"));
  const hasEntries = entryArgs.length > 0;

  console.clear();
  console.log("🧩 Prodex — Project Dependency Extractor\n");

  await runCombine({ entries: hasEntries ? entryArgs : null });
}
