export function showSummary({ outDir, fileName, entries }) {
  console.log("\n🧩 Active Run:");
  console.log(" • Output Directory:", outDir);
  console.log(" • File Name:", fileName);
  console.log(" • Entries:", entries.length);
}
