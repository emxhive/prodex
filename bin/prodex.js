#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const devPath = path.resolve(__dirname, "../src/index.js");
const distPath = path.resolve(__dirname, "../dist/src/index.js");

// prefer dist in published package
const entry = fs.existsSync(distPath) ? distPath : devPath;

// convert to file:// URL for cross-platform ESM loading
const entryUrl = pathToFileURL(entry).href;

import(entryUrl).then(({ default: startProdex }) => startProdex());
