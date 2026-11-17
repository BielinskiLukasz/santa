import { describe, expect, it } from 'vitest';
import { pl } from '../../src/i18n/pl';

describe('Polskie teksty', () => {
  it('zawierają nazwę projektu i informację o etapie', () => {
    expect(pl.appName).toBe('Zwierzęta losują');
    expect(pl.phaseZero).toContain('kolejnych fazach');
  });
});