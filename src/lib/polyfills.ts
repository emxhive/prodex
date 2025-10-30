import util from "util";

if (!String.prototype.norm) {
	String.prototype.norm = function () {
		return this.replace(/\\/g, "/");
	};
}

globalThis._2j = (obj: any): string => util.inspect(obj, { colors: true, depth: null, breakLength: 150 , compact: 3});
