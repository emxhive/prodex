import { resolveRoot } from "../app/project-context";
import { createDefaultConfig } from "../config/create-default-config";

export function initCommand(rootArg: string | undefined, cwd: string, force?: boolean) {
	const root = resolveRoot(rootArg, cwd);
	return createDefaultConfig(root, { force });
}
