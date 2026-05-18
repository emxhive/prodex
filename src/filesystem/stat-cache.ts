import fsp from "fs/promises";
import { CacheManager } from "../cache/cache-manager";

export async function safeStatCached(namespace: string, filePath: string): Promise<import("fs").Stats | null> {
	const cached = CacheManager.get(namespace, filePath);
	if (cached !== undefined) return cached;

	try {
		const stats = await fsp.stat(filePath);
		CacheManager.set(namespace, filePath, stats);
		return stats;
	} catch {
		CacheManager.set(namespace, filePath, null);
		return null;
	}
}
