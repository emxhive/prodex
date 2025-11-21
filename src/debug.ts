import startProdex from "./index";
import "source-map-support/register";


(async () => {
	const mockArgs = ["node", "prodex", "@web",  "-cd"];
	process.argv = mockArgs;

//"-f", "**/(dashboard|accounts).tsx",
	console.log("🧩 Debug runner starting...");
	await startProdex();
	console.log("🧩 Debug runner done.");
})();
