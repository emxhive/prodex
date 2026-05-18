import fs from "fs";
import path from "path";
import { DEFAULT_PRODEX_CONFIG } from "./default-config";

export interface InitResult {
	ok: boolean;
	path: string;
	message?: string;
	error?: string;
}

export function createDefaultConfig(root = process.cwd(), opts: { force?: boolean } = {}): InitResult {
	const dest = path.join(root, "prodex.json");

	if (fs.existsSync(dest) && !opts.force) {
		return {
			ok: false,
			path: dest,
			error: "prodex.json already exists.",
		};
	}

	fs.writeFileSync(dest, `${JSON.stringify(DEFAULT_PRODEX_CONFIG, null, 4)}\n`, "utf8");
	return {
		ok: true,
		path: dest,
		message: `Created ${dest}`,
	};
}
