// @ts-nocheck

export function unique(arr) {
  return [...new Set(arr)];
}export function setDiff(A, B) {
  return new Set([...A].filter(x => !B.has(x)));
}
export function toArray(v) {
  return Array.isArray(v) ? v : [v];
}
