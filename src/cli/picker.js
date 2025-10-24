import inquirer from "inquirer";

export async function pickEntries() {
  const { path } = await inquirer.prompt([
    { name: "path", message: "Enter path to combine:", default: "src" }
  ]);
  return [path];
}
