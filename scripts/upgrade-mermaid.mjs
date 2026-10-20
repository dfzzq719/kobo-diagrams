#!/usr/bin/env node
// Prepare an engine update locally. Consumer deployments and frozen packages
// remain versioned artifacts and require their own rebuild/review.
import {readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arguments_ = process.argv.slice(2);
let target;
if (arguments_.length) {
  if (arguments_.length !== 2 || arguments_[0] !== '--target' || !/^\d+\.\d+\.\d+$/.test(arguments_[1])) {
    throw new Error('Use npm run upgrade:mermaid -- --target X.Y.Z, or omit --target to query the npm latest tag.');
  }
  target = arguments_[1];
}
const npmCli = [process.env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')].find(value => value && existsSync(value));
const npm = (args, capture = true) => {
  if (process.platform === 'win32' && !npmCli) throw new Error('Run this script through npm run upgrade:mermaid so the npm CLI path is available.');
  const result = spawnSync(npmCli ? process.execPath : 'npm', npmCli ? [npmCli, ...args] : args, {cwd: root, encoding: 'utf8', windowsHide: true, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm ${args[0]} failed${result.stderr ? ': ' + result.stderr.trim() : '.'}`);
  return result.stdout?.trim();
};
const registry = ['--registry', 'https://registry.npmjs.org/'];
if (!target) target = JSON.parse(npm(['view', 'mermaid', 'version', '--json', ...registry]));
if (!/^\d+\.\d+\.\d+$/.test(target)) throw new Error('Only stable Mermaid X.Y.Z versions are supported by this helper.');
// Confirm existence before changing any local source.
const published = JSON.parse(npm(['view', `mermaid@${target}`, 'version', '--json', ...registry]));
if (published !== target) throw new Error(`Registry did not resolve exact Mermaid ${target}.`);
const packagePath = path.join(root, 'package.json');
const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
manifest.peerDependencies.mermaid = target;
manifest.devDependencies.mermaid = target;
const versionPath = path.join(root, 'src/version.mjs');
const declarationsPath = path.join(root, 'index.d.ts');
const version = (await readFile(versionPath, 'utf8')).replace(/export const MERMAID_VERSION = '[^']+';/, `export const MERMAID_VERSION = '${target}';`);
const declarations = (await readFile(declarationsPath, 'utf8')).replace(/export const MERMAID_VERSION: '[^']+';/, `export const MERMAID_VERSION: '${target}';`);
await writeFile(packagePath, JSON.stringify(manifest, null, 2) + '\n');
await writeFile(versionPath, version);
await writeFile(declarationsPath, declarations);
npm(['install', '--ignore-scripts', ...registry], false);
process.stdout.write(`Prepared Mermaid ${target} with an updated lockfile. Run npm test and npm run test:browser, review compatibility, and release a new core version as appropriate. Rebuild and redeploy each consumer and regenerate frozen packages separately.\n`);
