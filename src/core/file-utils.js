import path from "path";

export function generateOutputName(entries) {
  const names = entries.map(f => path.basename(f, path.extname(f)));
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}-${names[1]}`;
  if (names.length > 2) return `${names[0]}-and-${names.length - 1}more`;
  return "unknown";
}

export function resolveOutputPath(outputDir, base) {
  return path.join(outputDir, `prodex-${base}-combined.txt`);
}
