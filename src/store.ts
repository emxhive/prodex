import { ProdexConfig, ProdexFlags } from "./types";

let globalConfig = null;
let globalFlags = null;

export function setGlobals(cfg, flags: Partial<ProdexFlags>) {
	globalConfig = cfg;
	globalFlags = flags;
	globalThis.__PRODEX__ = Object.freeze({ config: cfg, flags });
}

export const getConfig = (): ProdexConfig => globalConfig || globalThis.__PRODEX__?.config;
export const getFlags = (): ProdexFlags => globalFlags || globalThis.__PRODEX__?.flags;
