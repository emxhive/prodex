import startProdex from "./index";

(async () => {
	const mockArgs = ["node", "prodex", "C:\\Users\\USER\\Herd\\fireshot", "-f", "**/(dashboard|accounts).tsx", "-cd"];
	process.argv = mockArgs;


	console.log("🧩 Debug runner starting...");
	await startProdex();
	console.log("🧩 Debug runner done.");
})();
