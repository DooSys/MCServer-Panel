import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const distRoot = path.resolve('dist');
const serverNested = path.join(distRoot, 'server', 'server');
const sharedNested = path.join(distRoot, 'server', 'shared');
const serverOut = path.join(distRoot, 'server');
const sharedOut = path.join(distRoot, 'shared');

async function exists(target) {
  return stat(target).then(() => true).catch(() => false);
}

if (!(await exists(path.join(serverNested, 'index.js')))) {
  throw new Error(`Compiled server entry not found at ${path.join(serverNested, 'index.js')}`);
}

await mkdir(serverOut, { recursive: true });
await cp(serverNested, serverOut, { recursive: true, force: true });

if (await exists(sharedNested)) {
  await rm(sharedOut, { recursive: true, force: true });
  await cp(sharedNested, sharedOut, { recursive: true, force: true });
}

console.log('[build] server entry prepared at dist/server/index.js');
