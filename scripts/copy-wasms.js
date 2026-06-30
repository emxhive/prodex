const fs = require("node:fs");
const path = require("node:path");

const srcDir = path.resolve(__dirname, "../node_modules/@vscode/tree-sitter-wasm/wasm");
const destAssets = path.resolve(__dirname, "../assets/tree-sitter");
const destFixtures = path.resolve(__dirname, "../test/fixtures/tree-sitter");

fs.mkdirSync(destAssets, { recursive: true });
fs.mkdirSync(destFixtures, { recursive: true });

const files = ["tree-sitter-typescript.wasm", "tree-sitter-tsx.wasm"];

for (const file of files) {
	const srcPath = path.join(srcDir, file);
	if (!fs.existsSync(srcPath)) {
		console.error(`ERROR: Pinned WASM source file is missing: ${srcPath}`);
		process.exit(1);
	}
	fs.copyFileSync(srcPath, path.join(destAssets, file));
	fs.copyFileSync(srcPath, path.join(destFixtures, file));
}
console.log("TypeScript and TSX WASM assets copied successfully.");
