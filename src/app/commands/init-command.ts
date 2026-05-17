import { resolveRoot } from "../project-context";
import { initProdex } from "../../cli/init";

export function initCommand(rootArg: string | undefined, cwd: string, force?: boolean) {
	const root = resolveRoot(rootArg, cwd);
	return initProdex(root, { force });
}
