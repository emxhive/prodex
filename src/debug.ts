import startProdex from "./index";
import "source-map-support/register";


(async () => {
	const mockArgs = ["node", "prodex", "@web", "-f", "**/(dashboard|accounts).tsx", "-cd"];
	process.argv = mockArgs;


	console.log("🧩 Debug runner starting...");
	await startProdex();
	console.log("🧩 Debug runner done.");
})();
