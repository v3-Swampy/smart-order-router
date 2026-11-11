import JSBI from 'jsbi';

import { CurrencyAmount } from '../../../util/amounts';

const HUNDRED = JSBI.BigInt(100);
const ZERO = JSBI.BigInt(0);

/**
 * Split an amount into integer amounts for the given (whole) percentages.
 *
 * The quoter, the simulator, the calldata and `value` only ever use
 * `CurrencyAmount.quotient`, i.e. the integer part in the token's smallest unit
 * (see `on-chain-quote-provider`, which encodes `amount.quotient`). Building the
 * candidates with `Fraction` (e.g. 95% of 50000000000000000010 =
 * 47500000000000000009.5) leaves a fractional remainder that is silently floored
 * per route, so a split route ends up spending less than the requested amount.
 * Producing integer candidates from the start keeps quoting, simulation, calldata
 * and `methodParameters.value` on the same numbers.
 */
export function getAmountsForPercents(amount: CurrencyAmount, percents: number[]): CurrencyAmount[] {
  const total = amount.quotient;
  return percents.map((percent) =>
    CurrencyAmount.fromRawAmount(
      amount.currency,
      JSBI.divide(JSBI.multiply(total, JSBI.BigInt(percent)), HUNDRED)
    )
  );
}

export function calculateAmountDistribution(
  amount: CurrencyAmount,
  distributionPercent: number
): [number[], CurrencyAmount[]] {
  const percents: number[] = [];
  for (let i = 1; i <= 100 / distributionPercent; i++) {
    percents.push(i * distributionPercent);
  }
  return [percents, getAmountsForPercents(amount, percents)];
}

/**
 * Reconcile the selected routes against the requested amount using integer
 * arithmetic. Every route amount is normalised to its quotient first (that is the
 * only value ever quoted/encoded), then the remainder is added to the route with
 * the largest amount, where the relative slippage impact is the smallest.
 *
 * Summing fractional `CurrencyAmount`s (as the original code did) always returns
 * the exact requested amount (e.g. 95/100 + 5/100) and therefore hid the
 * per-route flooring. The remainder is bounded by `routeAmounts.length - 1` units,
 * so the quote stays accurate; for EXACT_OUTPUT the extra output is covered by the
 * client's absolute slack on `amountInMaximum`.
 *
 * Returns the missing amount (0 when nothing had to be added, negative when the
 * routes already exceed the requested amount).
 */
export function reconcileSplitAmounts<T extends { amount: CurrencyAmount }>(
  amount: CurrencyAmount,
  routeAmounts: T[]
): JSBI {
  let total = ZERO;
  let largestIndex = -1;
  let largestAmount = ZERO;
  for (let i = 0; i < routeAmounts.length; i++) {
    const routeAmount = routeAmounts[i]!;
    const normalized = CurrencyAmount.fromRawAmount(routeAmount.amount.currency, routeAmount.amount.quotient);
    routeAmount.amount = normalized;
    total = JSBI.add(total, normalized.quotient);
    if (JSBI.greaterThan(normalized.quotient, largestAmount) || largestIndex < 0) {
      largestIndex = i;
      largestAmount = normalized.quotient;
    }
  }

  const missing = JSBI.subtract(amount.quotient, total);
  if (JSBI.greaterThan(missing, ZERO) && largestIndex >= 0) {
    const target = routeAmounts[largestIndex]!;
    target.amount = CurrencyAmount.fromRawAmount(
      target.amount.currency,
      JSBI.add(target.amount.quotient, missing)
    );
  }

  return missing;
}
