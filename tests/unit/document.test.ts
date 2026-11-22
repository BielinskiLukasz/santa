// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { pl } from '../../src/i18n/pl';

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');
const page = new DOMParser().parseFromString(source, 'text/html');

describe('Powłoka aplikacji', () => {
  it('ma polski język i nazwę projektu w tytule', () => {
    expect(page.documentElement.lang).toBe('pl');
    expect(page.title).toContain(pl.appName);
  });

  it('montuje aplikację React w elemencie #root', () => {
    expect(page.querySelector('#root')).not.toBeNull();
    expect(page.querySelector('script[type="module"][src="/src/main.tsx"]')).not.toBeNull();
  });
});
