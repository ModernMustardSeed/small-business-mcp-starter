/**
 * Fails when any tracked text file contains an em dash or an en dash.
 * Tool descriptions are read by Claude and listing copy by reviewers; plain
 * punctuation keeps both clean.
 *
 *   node scripts/check-prose.mjs
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && /\.(ts|tsx|mjs|js|json|md|css|yml|yaml|txt)$/.test(f) && f !== 'pnpm-lock.yaml');

const DASH = /[\u2014\u2013]/;
let hits = 0;
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (DASH.test(line)) {
      hits++;
      console.log(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`);
    }
  });
}
console.log(hits ? `\n${hits} line(s) with an em or en dash.` : `No em or en dashes in ${files.length} files.`);
if (hits) process.exitCode = 1;
