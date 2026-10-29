import { ChainId } from '../../util/chains';
import { SingleFlight } from '../../util/single-flight';

import { ICache } from './../cache';
import { IV3SubgraphProvider, V3SubgraphPool } from './subgraph-provider';

/**
 * Provider for getting V3 pools, with functionality for caching the results.
 *
 * @export
 * @class CachingV3SubgraphProvider
 */
export class CachingV3SubgraphProvider implements IV3SubgraphProvider {
  private SUBGRAPH_KEY = (chainId: ChainId) => `subgraph-pools-${chainId}`;
  private inFlight = new SingleFlight();

  /**
   * Creates an instance of CachingV3SubgraphProvider.
   * @param chainId The chain id to use.
   * @param subgraphProvider The provider to use to get the subgraph pools when not in the cache.
   * @param cache Cache instance to hold cached pools.
   */
  constructor(
    private chainId: ChainId,
    protected subgraphProvider: IV3SubgraphProvider,
    private cache: ICache<V3SubgraphPool[]>
  ) {}

  public async getPools(): Promise<V3SubgraphPool[]> {
    const key = this.SUBGRAPH_KEY(this.chainId);
    const cachedPools = await this.cache.get(key);

    if (cachedPools) {
      return cachedPools;
    }

    // A cache miss at TTL expiry can otherwise cause every concurrent request
    // to paginate the entire subgraph at the same time.
    return this.inFlight.run(key, async () => {
      const cachedPoolsAfterWait = await this.cache.get(key);
      if (cachedPoolsAfterWait) {
        return cachedPoolsAfterWait;
      }

      const pools = await this.subgraphProvider.getPools();

      await this.cache.set(key, pools);

      return pools;
    });
  }
}
