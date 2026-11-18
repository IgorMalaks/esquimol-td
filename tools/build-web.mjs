import { cp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const destination = 'dist';
await mkdir(destination, { recursive: true });
for (const name of ['index.html', 'js', 'css', 'assets', 'preview']) {
  await cp(name, join(destination, name), { recursive: true });
}
