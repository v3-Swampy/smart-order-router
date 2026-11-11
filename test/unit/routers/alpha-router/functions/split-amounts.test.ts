import { Fraction } from '@uniswap/sdk-core';
import JSBI from 'jsbi';
import { CurrencyAmount, USDC_MAINNET as USDC } from '../../../../../src';
import {
  calculateAmountDistribution,
  getAmountsForPercents,
  reconcileSplitAmounts,
} from '../../../../../src/routers/alpha-router/functions/split-amounts';

const AMOUNT = '50000000000000000010';

describe('split amounts', () => {
  const amount = CurrencyAmount.fromRawAmount(USDC, AMOUNT);

  test('distribution candidates are integers and 100% is the full amount', () => {
    const [percents, amounts] = calculateAmountDistribution(amount, 5);

    expect(percents).toHaveLength(20);
    expect(percents[0]).toBe(5);
    expect(percents[19]).toBe(100);
    expect(amounts).toHaveLength(20);
    expect(amounts.every((candidate) => candidate.denominator.toString() === '1')).toBeTruthy();
    // 5% / 95% / 100% of ...010
    expect(amounts[0]!.quotient.toString()).toBe('2500000000000000000');
    expect(amounts[18]!.quotient.toString()).toBe('47500000000000000009');
    expect(amounts[19]!.quotient.toString()).toBe(AMOUNT);
  });

  test('getAmountsForPercents floors instead of keeping a fractional amount', () => {
    const amounts = getAmountsForPercents(amount, [75, 25]);

    expect(amounts[0]!.quotient.toString()).toBe('37500000000000000007');
    expect(amounts[1]!.quotient.toString()).toBe('12500000000000000002');
    expect(amounts[0]!.denominator.toString()).toBe('1');
    expect(amounts[1]!.denominator.toString()).toBe('1');
  });

  test('reconcileSplitAmounts adds the dust lost to per-route flooring to the largest route', () => {
    // Fractional amounts are what the old implementation produced: 95/5 of ...010
    // is ...009.5 + ...000.5. Their fractional sum is exact, but their quotients
    // only add up to ...009.
    const routes = [
      { amount: amount.multiply(new Fraction(95, 100)) },
      { amount: amount.multiply(new Fraction(5, 100)) },
    ];

    const missing = reconcileSplitAmounts(amount, routes);

    expect(missing.toString()).toBe('1');
    expect(routes[0]!.amount.denominator.toString()).toBe('1');
    expect(routes[1]!.amount.denominator.toString()).toBe('1');
    // the whole remainder goes to the largest route, never to the small one
    expect(routes[0]!.amount.quotient.toString()).toBe('47500000000000000010');
    expect(routes[1]!.amount.quotient.toString()).toBe('2500000000000000000');
    expect(
      JSBI.add(routes[0]!.amount.quotient, routes[1]!.amount.quotient).toString()
    ).toBe(AMOUNT);
  });

  test('reconcileSplitAmounts reconciles the integer candidates of a 95/5 split', () => {
    const [, amounts] = calculateAmountDistribution(amount, 5);
    const routes = [{ amount: amounts[18]! }, { amount: amounts[0]! }];

    const missing = reconcileSplitAmounts(amount, routes);

    expect(missing.toString()).toBe('1');
    expect(routes[0]!.amount.quotient.toString()).toBe('47500000000000000010');
    expect(routes[1]!.amount.quotient.toString()).toBe('2500000000000000000');
    expect(
      JSBI.add(routes[0]!.amount.quotient, routes[1]!.amount.quotient).toString()
    ).toBe(AMOUNT);
  });

  test('reconcileSplitAmounts is a no-op when the split already adds up', () => {
    const routes = [{ amount: CurrencyAmount.fromRawAmount(USDC, AMOUNT) }];

    expect(reconcileSplitAmounts(amount, routes).toString()).toBe('0');
    expect(routes[0]!.amount.quotient.toString()).toBe(AMOUNT);
  });
});
