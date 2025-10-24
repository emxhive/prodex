import inquirer from "inquirer";
import fs from "fs";
import path from "path";

export async function runCombine() {
  console.log("📦 Combine mode active. (Stub)");
  console.log("This is where the full combine logic from your previous script will go.\n");

  const { confirm } = await inquirer.prompt([
    { type: "confirm", name: "confirm", message: "Would you like to list project files?", default: true }
  ]);

  if (confirm) {
    const files = fs.readdirSync(process.cwd());
    console.log("Found files:", files);
  } else {
    console.log("Aborted.");
  }
}
