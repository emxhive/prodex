import util from "util";
import inspector from "inspector";
import { getFlags } from "../store";

const FLAGS = getFlags();

console.log(FLAGS, "FLAGS");

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

globalThis._bp = function (ctx?: any) {
	if (!FLAGS.debug) return;

	const session = new inspector.Session();
	session.connect();

	console.log("\n🧩 Breakpoint hit", ctx ? "→" : "", ctx || "");

	// Get the current call stack and pause in the caller's frame
	const err = new Error();
	const stack = err.stack?.split("\n")[2]?.trim() ?? "unknown";
	console.log("Pausing at:", stack);

	// Tell inspector to enable and pause
	session.post("Debugger.enable", () => {
		// Inject a breakpoint at the *previous* call frame
		session.post("Debugger.pause");
	});

	// keep session open long enough for the pause to register
	setTimeout(() => session.disconnect(), 100);
};
