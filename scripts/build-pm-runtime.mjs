#!/usr/bin/env node
/** Build the portable Skill runtime from this repository's unchanged core. */
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'skills/taskobo-diagrams/assets/runtime');
const sha=value=>createHash('sha256').update(value).digest('hex');
const normalized=value=>Buffer.from(value.toString('utf8').replace(/\r\n/g,'\n'));
const pinnedVendor='a8a6a6f805b074a8261a2825c86f99c8054acb3b35f50bb7e24a4f9f2c3c3b9f';
const args=process.argv.slice(2);let check=false,vendor;
for(let i=0;i<args.length;i++){
  if(args[i]==='--check')check=true;
  else if(args[i]==='--vendor'&&args[i+1])vendor=path.resolve(args[++i]);
  else throw new Error('用法：node scripts/build-pm-runtime.mjs [--check] [--vendor <Mermaid 12.2.0 mermaid.min.js>]');
}
const files={};
for(const name of (await readdir(path.join(root,'src'))).filter(name=>name.endsWith('.mjs')).sort())files['core/'+name]=normalized(await readFile(path.join(root,'src',name)));
for(const name of ['LICENSE','NOTICE'])files[name]=normalized(await readFile(path.join(root,name)));
// A clean checkout can check the committed runtime without any workspace vendor.
vendor=vendor||[path.join(root,'node_modules/mermaid/dist/mermaid.min.js'),...(check?[path.join(target,'mermaid.min.js')]:[]),path.resolve(root,'../../free-tools/mermaid/vendor/mermaid.min.js')].find(existsSync);
if(!vendor)throw new Error('找不到 Mermaid 12.2.0。先安装仓库开发依赖，或用 --vendor 指定已验证的官方文件。');
const vendorBytes=normalized(await readFile(vendor));
if(sha(vendorBytes)!==pinnedVendor)throw new Error('Mermaid 文件与已核验的 12.2.0 官方 bundle 不一致；不能替换或静默升级。');
files['mermaid.min.js']=vendorBytes;
const licensePath=[path.join(root,'node_modules/mermaid/LICENSE'),path.join(target,'mermaid-LICENSE.txt'),path.resolve(root,'../../free-tools/mermaid/vendor/mermaid-LICENSE.txt')].find(existsSync);
if(!licensePath)throw new Error('缺少 Mermaid MIT 许可文件。');
files['mermaid-LICENSE.txt']=normalized(await readFile(licensePath));
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const manifest={schema:'kobo.pm-runtime/v1',coreVersion:pkg.version,mermaidVersion:pkg.peerDependencies.mermaid,textEncoding:'UTF-8/LF',fileSHA256:Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b,'en')).map(([name,bytes])=>[name,sha(bytes)]))};
files['manifest.json']=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
for(const [name,bytes]of Object.entries(files)){
  const file=path.join(target,name);
  if(check){if(!existsSync(file)||!normalized(await readFile(file)).equals(bytes))throw new Error('Skill runtime 漂移：'+name+'。请运行构建并提交生成文件。');}
  else{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);}
}
const tracked=new Set(Object.keys(files));
async function walk(directory,prefix=''){for(const entry of await readdir(directory,{withFileTypes:true})){const name=prefix+entry.name;if(entry.isDirectory())await walk(path.join(directory,entry.name),name+'/');else if(!tracked.has(name))throw new Error('Skill runtime 包含未登记文件：'+name);}}
await walk(target);
console.log(JSON.stringify({verified:check,built:!check,coreVersion:manifest.coreVersion,mermaidVersion:manifest.mermaidVersion,files:Object.keys(files).length,manifestSHA256:sha(files['manifest.json'])},null,2));
