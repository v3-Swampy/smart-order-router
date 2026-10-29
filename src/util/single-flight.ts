/**
 * Coalesces concurrent async work for the same key.
 *
 * If a caller asks for a key that is already being resolved, it receives the
 * same promise instead of starting a second request. Once the promise settles,
 * the key is removed so later callers can refresh it.
 *
 * This is intentionally process-local: it prevents a cache miss from turning
 * into N simultaneous upstream requests in a single server process, without
 * changing the cache TTL.
 */
export class SingleFlight {
  private inFlight = new Map<string, Promise<unknown>>();

  public run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = Promise.resolve()
      .then(fn)
      .then(
        (result) => {
          this.inFlight.delete(key);
          return result;
        },
        (error) => {
          this.inFlight.delete(key);
          throw error;
        }
      );

    this.inFlight.set(key, promise);
    return promise;
  }
}
