const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const srcRoot = path.join(root, "src");

const forbiddenDirs = ["core", "render", "platform", "shared", "constants", "lib"];
const errors = [];

for (const dir of forbiddenDirs) {
	const fullPath = path.join(srcRoot, dir);
	if (fs.existsSync(fullPath)) errors.push(`Forbidden legacy directory exists: src/${dir}`);
}

for (const file of tsFiles(srcRoot)) {
	const relPath = normalize(path.relative(root, file));
	const source = fs.readFileSync(file, "utf8");

	for (const dir of forbiddenDirs) {
		const legacyImport = new RegExp(`from\\s+["'][^"']*(?:^|/)${dir}(?:/|["'])`);
		if (legacyImport.test(source)) errors.push(`${relPath} imports legacy bucket "${dir}".`);
	}

	if (relPath.startsWith("src/commands/")) {
		const forbiddenCommandImports = [
			"../tracing",
			"../output",
			"../filesystem",
			"../cache",
			"../legacy/resolvers",
			"../diagnostics",
		];
		for (const importPath of forbiddenCommandImports) {
			if (source.includes(`from "${importPath}`) || source.includes(`from '${importPath}`)) {
				errors.push(`${relPath} crosses the command boundary via ${importPath}.`);
			}
		}
	}

	if (relPath.startsWith("src/legacy/resolvers/") && importsFrom(source, "../../../tracing", "../../tracing", "../tracing")) {
		errors.push(`${relPath} imports tracing internals from the resolver layer.`);
	}

	if (relPath.startsWith("src/output/") && importsFrom(source, "../tracing")) {
		errors.push(`${relPath} imports tracing internals from the output layer.`);
	}
}

if (errors.length) {
	console.error("Architecture check failed:");
	for (const error of errors) console.error(`- ${error}`);
	process.exit(1);
}

function tsFiles(dir) {
	const out = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...tsFiles(fullPath));
		else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(fullPath);
	}
	return out;
}

function normalize(value) {
	return value.replace(/\\/g, "/");
}

function importsFrom(source, ...importPaths) {
	return importPaths.some((importPath) => {
		return source.includes(`from "${importPath}`) || source.includes(`from '${importPath}`);
	});
}
