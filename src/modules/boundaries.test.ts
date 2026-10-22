// Module boundaries: core is shared; data and twin never depend on the game; only the game reuses the twin.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = fileURLToPath(new URL('..', import.meta.url));
const files = (dir: string): string[] => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
});
const importsOf = (dir: string) => files(join(src, dir)).flatMap(f =>
  [...readFileSync(f, 'utf8').matchAll(/from '([^']+)'/g)].map(m => ({ file: f.slice(src.length), spec: m[1] })));

describe('module boundaries', () => {
  it('core imports no module', () => {
    expect(importsOf('core').filter(i => i.spec.includes('modules/'))).toEqual([]);
  });
  it('the data module imports only core', () => {
    expect(importsOf('modules/data').filter(i => /twin|game/.test(i.spec))).toEqual([]);
  });
  it('the twin module never imports the game or data modules', () => {
    expect(importsOf('modules/twin').filter(i => /\/game\/|\/data\//.test(i.spec))).toEqual([]);
  });
  it('the game module does not import the data module', () => {
    expect(importsOf('modules/game').filter(i => i.spec.includes('/data/'))).toEqual([]);
  });
});
