import fs from "fs";
import path from "path";
import { ROOT } from "../constants/config.js";

export function loadLaravelBindings() {
    const providersDir = path.join(ROOT, "app", "Providers");
    const bindings = {};

    if (!fs.existsSync(providersDir)) return bindings;

    const files = fs
        .readdirSync(providersDir)
        .filter(f => f.endsWith(".php"))
        .map(f => path.join(providersDir, f));

    // Match: $this->app->bind(Interface::class, Implementation::class)
    const re =
        /$this->app->(?:bind|singleton)\s*\(\s*([A-Za-z0-9_:\\\\]+)::class\s*,\s*([A-Za-z0-9_:\\\\]+)::class/g;

    for (const file of files) {
        const code = fs.readFileSync(file, "utf8");
        let m;
        while ((m = re.exec(code))) {
            const iface = m[1].replace(/\\\\/g, "\\");
            const impl = m[2].replace(/\\\\/g, "\\");
            bindings[iface] = impl;
        }
    }

    return bindings;
}
