export function newStats() {
  return { expected: new Set(), resolved: new Set() };
}

export function mergeStats(target, src) {
  src.expected.forEach(i => target.expected.add(i));
  src.resolved.forEach(i => target.resolved.add(i));
  return target;
}

export function emptyStats() {
  return { expected: new Set(), resolved: new Set() };
}
