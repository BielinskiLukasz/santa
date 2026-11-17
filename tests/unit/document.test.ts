// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { pl } from '../../src/i18n/pl';

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');
const page = new DOMParser().parseFromString(source, 'text/html');

describe('Strona startowa', () => {
  it('ma polski język i nazwę projektu', () => {
    expect(page.documentElement.lang).toBe('pl');
    expect(page.querySelector('h1')?.textContent?.replace(/\s+/g, '')).toContain(
      pl.appName.replace(/\s+/g, ''),
    );
    expect(page.body.textContent).toContain(pl.phaseZero);
  });

  it('zawiera odnośnik do opisu oraz wymagany skrypt Tailwind', () => {
    expect(page.querySelector('a[href="#projekt"]')).not.toBeNull();
    expect(
      page.querySelector('script[src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"]'),
    ).not.toBeNull();
  });
});