import type { TraceStats } from "../types";

export function newStats(): TraceStats {
	return { expected: new Set(), resolved: new Set() };
}

export function mergeStats(target: TraceStats, src: TraceStats): TraceStats {
	src.expected.forEach((item) => target.expected.add(item));
	src.resolved.forEach((item) => target.resolved.add(item));
	return target;
}

export function unique<T>(arr: T[]): T[] {
	return [...new Set(arr)];
}
