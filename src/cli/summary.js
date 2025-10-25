export function showSummary({ outputDir, fileName, entries, scanDepth, limit, chain }) {
  console.log("\n🧩 Active Run:");
  console.log(" • Output Directory:", outputDir);
  console.log(" • File Name:", fileName);
  console.log(" • Entries:", entries.length);
  console.log(" • Scan Depth:", scanDepth);
  console.log(" • Limit:", limit);
  console.log(" • Chain:", chain ? "Enabled" : "Disabled");
}
