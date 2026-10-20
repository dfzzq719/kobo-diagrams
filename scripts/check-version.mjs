#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {CORE_VERSION, MERMAID_VERSION} from '../src/version.mjs';

const require = createRequire(import.meta.url);
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
let installed;
try {installed = JSON.parse(await readFile(require.resolve('mermaid/package.json'), 'utf8'));}
catch {throw new Error('Mermaid is not installed. Run npm ci before testing.');}
const declarations = await readFile(new URL('../index.d.ts', import.meta.url), 'utf8');
const versions = {
  'devDependencies.mermaid': manifest.devDependencies?.mermaid,
  'peerDependencies.mermaid': manifest.peerDependencies?.mermaid,
  'installed mermaid': installed.version,
  'TypeScript MERMAID_VERSION': declarations.match(/export const MERMAID_VERSION: '([^']+)'/)?.[1],
};
const mismatches = Object.entries(versions).filter(([, version]) => version !== MERMAID_VERSION);
if (manifest.version !== CORE_VERSION) mismatches.push(['package core version', manifest.version]);
const declaredCoreVersion = declarations.match(/export const CORE_VERSION: '([^']+)'/)?.[1];
if (declaredCoreVersion !== CORE_VERSION) mismatches.push(['TypeScript CORE_VERSION', declaredCoreVersion]);
if (mismatches.length) {
  throw new Error(`Version mismatch; source core=${CORE_VERSION}, engine=${MERMAID_VERSION}. ${mismatches.map(([label, value]) => `${label}=${value}`).join('; ')}. Use npm run upgrade:mermaid -- --target X.Y.Z and review the release together.`);
}
process.stdout.write(`Versions aligned: @taskobo/diagrams ${CORE_VERSION}, Mermaid ${MERMAID_VERSION}.\n`);
