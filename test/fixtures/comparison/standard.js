// Standard ESM imports
import { hello } from "./helper";
import * as nested from "./nested";
import defaultExport from "./helper.js";

// CommonJS requires
const fs = require("fs");
const path = require("node:path");
const lodash = require("lodash");
const helper = require("./helper");

export function run() {
	return hello;
}
