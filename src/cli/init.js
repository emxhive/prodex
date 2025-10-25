import fs from "fs";
import path from "path";
import inquirer from "inquirer";

export async function initProdex() {
  console.log("🪄 Prodex Init — Configuration Wizard\n");

  const dest = path.join(process.cwd(), ".prodex.json");
  if (fs.existsSync(dest)) {
    const { overwrite } = await inquirer.prompt([
      { type: "confirm", name: "overwrite", message: ".prodex.json already exists. Overwrite?", default: false }
    ]);
    if (!overwrite) {
      console.log("❌ Cancelled.");
      return;
    }
  }

  const jsonc = `{
  "$schema": "https://raw.githubusercontent.com/emxhive/prodex/main/schema/prodex.schema.json",
  "output": "prodex",
  "scanDepth": 2,
  "limit": 200,
  "baseDirs": ["app", "routes", "resources/js"],
  "aliasOverrides": {
    "@hooks": "resources/js/hooks",
    "@data": "resources/js/data"
  },
  "priorityFiles": [
    "routes/web.php",
    "routes/api.php",
    "index",
    "main",
    "app"
  ],
  "entryExcludes": [
    "resources/js/components/ui/",
    "app/DTOs/"
  ],
  "importExcludes": [
    "node_modules",
    "@shadcn/"
  ]
}
`;

  fs.writeFileSync(dest, jsonc, "utf8");
  console.log(`✅ Created ${dest}`);
  console.log("💡 You can edit it anytime or rerun 'prodex init' to reset.");
}
