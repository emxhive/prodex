// @ts-nocheck

import micromatch from "micromatch";

export function isExcluded(imp, exclude = []) {
  return micromatch.isMatch(imp.replaceAll("\\", "/"), exclude);
}
