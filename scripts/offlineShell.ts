import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';

function outputFiles(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = prefix + entry.name;
    if (entry.isDirectory()) return outputFiles(join(directory, entry.name), file + '/');
    return file === 'sw.js' ? [] : [file];
  });
}

export function offlineShell(): Plugin {
  return {
    name: 'eli-offline-shell',
    apply: 'build',
    writeBundle: {
      order: 'post',
      handler(options) {
        const directory = resolve(options.dir!);
        const files = outputFiles(directory).sort();
        const digest = createHash('sha256');
        for (const file of files) digest.update(file).update(readFileSync(join(directory, file)));
        const worker = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
        digest.update(worker);
        const version = digest.digest('hex').slice(0, 16);
        writeFileSync(join(directory, 'sw.js'),
          `const VERSION = ${JSON.stringify(version)};\nconst FILES = ${JSON.stringify(files)};\n${worker}`);
      },
    },
  };
}
