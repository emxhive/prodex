import { runCombine } from "./core/combine.js";
import { initProdex } from "./cli/init.js";

export default async function startProdex() {
  const args = process.argv.slice(2);
  if (args.includes("init")) return await initProdex();

  console.clear();
  console.log("🧩 Prodex — Project Dependency Extractor\\n");
  await runCombine();
}
