import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));

const extensionsToKeep = new Set(['.js', '.json', '.css', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.wasm']);

for (const file of await listFiles(distDir)) {
  if (!isPatchableOutput(file)) {
    continue;
  }

  const source = await readFile(file, 'utf8');
  const updated = source.replace(
    /(from\s+['"]|import\s*\(\s*['"])(\.{1,2}\/[^'"]+)(['"]\s*\)?)/g,
    (_match, prefix, specifier, suffix) => `${prefix}${withJsExtension(specifier)}${suffix}`,
  );

  if (updated !== source) {
    await writeFile(file, updated);
  }
}

function isPatchableOutput(file) {
  return file.endsWith('.js') || file.endsWith('.d.ts');
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function withJsExtension(specifier) {
  const lastSegment = specifier.split('/').at(-1) ?? '';

  if (extensionsToKeep.has(extname(lastSegment))) {
    return specifier;
  }

  return `${specifier}.js`;
}
