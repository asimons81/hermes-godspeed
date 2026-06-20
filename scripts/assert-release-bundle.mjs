import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const distAssets = join(process.cwd(), 'dist', 'assets');
const files = await readdir(distAssets);
const jsFiles = files.filter((file) => file.endsWith('.js'));
const forbidden = ['__PHASER_GAME__', 'test:forceGameOver', 'VITE_ENABLE_TEST_HOOKS'];

for (const file of jsFiles) {
  const text = await readFile(join(distAssets, file), 'utf8');

  for (const token of forbidden) {
    if (text.includes(token)) {
      throw new Error(`Release bundle contains forbidden test/debug token "${token}" in ${file}`);
    }
  }
}

console.log(`Release bundle check passed for ${jsFiles.length} JavaScript files.`);
