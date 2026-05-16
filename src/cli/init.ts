import fs from "fs";
import path from "path";
import { DEFAULT_PRODEX_CONFIG } from "../constants/default-config";
import { toJson } from "../lib/utils";

export interface InitResult {
	ok: boolean;
	path: string;
	message?: string;
	error?: string;
}

export function initProdex(root = process.cwd(), opts: { force?: boolean } = {}): InitResult {
	const dest = path.join(root, "prodex.json");

	if (fs.existsSync(dest) && !opts.force) {
		return {
			ok: false,
			path: dest,
			error: "prodex.json already exists. Use an explicit overwrite path if you want to replace it.",
		};
	}

	fs.writeFileSync(dest, toJson(DEFAULT_PRODEX_CONFIG) + "\n", "utf8");
	return {
		ok: true,
		path: dest,
		message: `Created ${dest}`,
	};
}
