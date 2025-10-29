import sade, { Value } from "sade";
import { PRODEX_FLAGS } from "./flags";

/**
 * Unified CLI parser powered by Sade.
 * Returns { entries, flags, warnings, errors }.
 */
export function parseCliInput(argv: string[] = process.argv.slice(2)) {
  const program = sade("prodex [entries...]");

  // Register flags dynamically
  for (const [key, meta] of Object.entries(PRODEX_FLAGS)) {
    const short = meta.short ? `-${meta.short}, ` : "";
    const long = `--${key}`;
    const desc = meta.description;

    let defaultVal: Value | undefined;
    switch (meta.type) {
      case "boolean":
        defaultVal = false;
        break;
      default:
        defaultVal = undefined; // defer strings/numbers/lists
    }

    if (defaultVal !== undefined) {
      program.option(`${short}${long}`, desc, defaultVal);
    } else {
      program.option(`${short}${long}`, desc);
    }
  }

  let parsed: { entries: string[]; flags: Record<string, any> } = {
    entries: [],
    flags: {}
  };

  program.action((entries: string[], opts: Record<string, any>) => {
    parsed = { entries, flags: opts };
  });

  program.parse(argv, { lazy: true });

  const warnings: string[] = [];
  const errors: string[] = [];

  // Post-parse casting + normalization
  for (const [key, meta] of Object.entries(PRODEX_FLAGS)) {
    const raw = parsed.flags[key];

    if (raw === undefined) continue;

    switch (meta.type) {
      case "number": {
        const num = Number(raw);
        if (Number.isNaN(num)) {
          errors.push(`Flag --${key} expected a number but got "${raw}"`);
        } else {
          parsed.flags[key] = num;
        }
        break;
      }

      case "list": {
        // Only syntax: --inc=a,b,c
        const arr = String(raw)
          .split(",")
          .map(v => v.trim())
          .filter(Boolean);
        parsed.flags[key] = arr;
        break;
      }
    }


  }

  return {
    entries: parsed.entries ?? [],
    flags: parsed.flags ?? {},
    warnings,
    errors
  };
}
