import fs from "fs";
import path from "path";
import { ROOT, CODE_EXTS, ENTRY_EXCLUDES } from "../constants/config.js";

export function rel(p){ return path.relative(ROOT, p).replaceAll("\\\\","/"); }
export function read(p){ try{return fs.readFileSync(p,"utf8");}catch{return"";} }
export function normalizeIndent(s){ return s.replace(/\\t/g,"  ").split("\\n").map(l=>l.replace(/[ \\t]+$/,"")).join("\\n"); }
export function stripComments(code, ext){
  let s = code.replace(/\\/\\*[\\s\\S]*?\\*\\//g,"");
  s = s.replace(/(^|[^:])\\/\\/.*$/gm,(_m,p1)=>p1);
  if(ext===".php") s = s.replace(/^\\s*#.*$/gm,"");
  return s;
}
export function isEntryExcluded(p){
  const r = rel(p);
  return ENTRY_EXCLUDES.some(ex => r.startsWith(ex) || r.includes(ex));
}
export function* walk(dir, depth=0, maxDepth=2){
  if(depth>maxDepth)return;
  const entries=fs.readdirSync(dir,{withFileTypes:true});
  for(const e of entries){
    const full=path.join(dir,e.name);
    if(e.isDirectory()) yield* walk(full,depth+1,maxDepth);
    else if(e.isFile()){
      const ext=path.extname(e.name).toLowerCase();
      if(CODE_EXTS.includes(ext) && !isEntryExcluded(full)) yield full;
    }
  }
}
