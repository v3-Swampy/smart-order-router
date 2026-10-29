import { SingleFlight } from '../../../src/util/single-flight';

describe('SingleFlight', () => {
  test('coalesces concurrent calls for the same key', async () => {
    const singleFlight = new SingleFlight();
    let calls = 0;

    const work = async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'result';
    };

    const [first, second] = await Promise.all([
      singleFlight.run('key', work),
      singleFlight.run('key', work),
    ]);

    expect(first).toBe('result');
    expect(second).toBe('result');
    expect(calls).toBe(1);
  });

  test('does not coalesce different keys', async () => {
    const singleFlight = new SingleFlight();
    const calls: string[] = [];

    const work = (key: string) => async () => {
      calls.push(key);
      return key;
    };

    const [first, second] = await Promise.all([
      singleFlight.run('a', work('a')),
      singleFlight.run('b', work('b')),
    ]);

    expect(first).toBe('a');
    expect(second).toBe('b');
    expect(calls.sort()).toEqual(['a', 'b']);
  });

  test('allows a retry after a rejection', async () => {
    const singleFlight = new SingleFlight();

    await expect(
      singleFlight.run('key', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    await expect(
      singleFlight.run('key', async () => 'recovered')
    ).resolves.toBe('recovered');
  });
});
