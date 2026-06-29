// Commented out import should not be captured
// import "./commented-helper";
/*
  const fake = require("./multiline-commented");
*/

// Tricky structures
const val = "import './in-string'";
console.log(val);

// Real import after comments
import { hello } from "./helper";
