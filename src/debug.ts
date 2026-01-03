import startProdex from "./index";
import "source-map-support/register";


(async () => {
	const mockArgs = ["node", "prodex", "-i", "src/**",  "-d"];
	process.argv = mockArgs;

//"-f", "**/(dashboard|accounts).tsx",
	console.log("🧩 Debug runner starting...");
	await startProdex();
	console.log("🧩 Debug runner done.");
})();
