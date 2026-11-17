import type { BudgetRange, BudgetValidation } from './types';

export const DEFAULT_BUDGET_RANGE: BudgetRange = Object.freeze({ min: 10, max: 2000 });

export function validateBudget(
  amount: unknown,
  range: BudgetRange = DEFAULT_BUDGET_RANGE,
): BudgetValidation {
  if (
    !range ||
    !Number.isSafeInteger(range.min) ||
    !Number.isSafeInteger(range.max) ||
    range.min < 0 ||
    range.max < range.min
  ) {
    return { ok: false, code: 'INVALID_RANGE' };
  }
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount)) {
    return { ok: false, code: 'INVALID_AMOUNT' };
  }
  if (amount < range.min || amount > range.max) {
    return { ok: false, code: 'OUT_OF_RANGE' };
  }
  return { ok: true, value: amount };
}