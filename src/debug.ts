import startProdex from "./index";

(async () => {
	const mockArgs = ["node", "prodex", "-f", "src/index.ts", "-c"];

	process.argv = mockArgs;

	console.log("🧩 Debug runner starting...");
	await startProdex();
	console.log("🧩 Debug runner done.");
})();
