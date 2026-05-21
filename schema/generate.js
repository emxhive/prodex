const { createGenerator } = require("ts-json-schema-generator");
const fs = require("fs");
const path = require("path");

const config = {
  path: "src/types/config.types.ts",
  tsconfig: "tsconfig.json",
  type: "ProdexConfigFile",
};

const schema = createGenerator(config).createSchema(config.type);

fs.writeFileSync(path.join(__dirname, "prodex.schema.json"), JSON.stringify(schema, null, 4));

if (process.env.PRODEX_SCHEMA_VERBOSE === "1") console.log("Schema generated.");
