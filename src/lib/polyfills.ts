import util from "util";

if (!String.prototype.norm) {
	String.prototype.norm = function () {
		return this.replace(/\\/g, "/");
	};
}

if (!String.prototype.clean) {
	String.prototype.clean = function () {
		return this.replace(/[<>:\"/\\|?*]+/g, "_");
	};
}

globalThis._2j = (obj: any): string => util.inspect(obj, { colors: true, depth: null, breakLength: 150, compact: 3 });
globalThis._bpt = function (param: any) {
	if (process.env.PRODEX_DEBUG !== "1") return;
	console.log("⭕ BREAKPOINT");
	if (typeof param === "function") param();
	else console.log(_2j(param));

	process.exit(1);
};
