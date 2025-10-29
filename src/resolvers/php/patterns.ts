// @ts-nocheck

export function extractPhpImports(code) {
  const out = new Set();
  const patterns = [
    /\b(?:require|include|require_once|include_once)\s*\(?['"]([^'"]+)['"]\)?/g,
    /\buse\s+([A-Z][\w\\]+(?:\s*{[^}]+})?)/g
  ];
  for (const r of patterns) {
    let m;
    while ((m = r.exec(code))) out.add(m[1]);
  }
  return out;
}
