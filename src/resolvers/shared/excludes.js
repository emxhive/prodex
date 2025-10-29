import micromatch from "micromatch";

export function isExcluded(imp, excludes = []) {
  return micromatch.isMatch(imp.replaceAll("\\", "/"), excludes);
}
