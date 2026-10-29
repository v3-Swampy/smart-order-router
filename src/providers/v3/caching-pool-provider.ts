import { Token } from '@uniswap/sdk-core';
import { FeeAmount, Pool } from '@uniswap/v3-sdk';
import _ from 'lodash';

import { ChainId } from '../../util/chains';
import { log } from '../../util/log';
import { SingleFlight } from '../../util/single-flight';

import { ICache } from './../cache';
import { ProviderConfig } from './../provider';
import { IV3PoolProvider, V3PoolAccessor } from './pool-provider';

/**
 * Provider for getting V3 pools, with functionality for caching the results.
 * Does not cache by block because we compute quotes using the on-chain quoter
 * so do not mind if the liquidity values are out of date.
 *
 * @export
 * @class CachingV3PoolProvider
 */
export class CachingV3PoolProvider implements IV3PoolProvider {
  private POOL_KEY = (chainId: ChainId, address: string) =>
    `pool-${chainId}-${address}`;
  private inFlight = new SingleFlight();

  /**
   * Creates an instance of CachingV3PoolProvider.
   * @param chainId The chain id to use.
   * @param poolProvider The provider to use to get the pools when not in the cache.
   * @param cache Cache instance to hold cached pools.
   */
  constructor(
    protected chainId: ChainId,
    protected poolProvider: IV3PoolProvider,
    private cache: ICache<Pool>
  ) {}

  public async getPools(
    tokenPairs: [Token, Token, FeeAmount][],
    providerConfig?: ProviderConfig
  ): Promise<V3PoolAccessor> {
    const poolAddressSet: Set<string> = new Set<string>();
    const uniquePools: Array<{
      poolAddress: string;
      token0: Token;
      token1: Token;
      feeAmount: FeeAmount;
    }> = [];

    for (const [tokenA, tokenB, feeAmount] of tokenPairs) {
      const { poolAddress, token0, token1 } = this.getPoolAddress(
        tokenA,
        tokenB,
        feeAmount
      );

      if (poolAddressSet.has(poolAddress)) {
        continue;
      }

      poolAddressSet.add(poolAddress);
      uniquePools.push({ poolAddress, token0, token1, feeAmount });
    }

    const poolsWithCacheResult = await Promise.all(
      uniquePools.map(async (pool) => ({
        ...pool,
        cachedPool: await this.cache.get(
          this.POOL_KEY(this.chainId, pool.poolAddress)
        ),
      }))
    );

    const poolsToGetTokenPairs: Array<[Token, Token, FeeAmount]> = [];
    const poolsToGetAddresses: string[] = [];
    const poolAddressToPool: { [poolAddress: string]: Pool } = {};

    for (const {
      poolAddress,
      token0,
      token1,
      feeAmount,
      cachedPool,
    } of poolsWithCacheResult) {
      if (cachedPool) {
        poolAddressToPool[poolAddress] = cachedPool;
        continue;
      }

      poolsToGetTokenPairs.push([token0, token1, feeAmount]);
      poolsToGetAddresses.push(poolAddress);
    }

    if (log.info()) {
      log.info(
        {
          poolsFound: _.map(
            Object.values(poolAddressToPool),
            (p) => `${p.token0.symbol} ${p.token1.symbol} ${p.fee}`
          ),
          poolsToGetTokenPairs: _.map(
            poolsToGetTokenPairs,
            (t) => `${t[0].symbol} ${t[1].symbol} ${t[2]}`
          ),
        },
        `Found ${
          Object.keys(poolAddressToPool).length
        } V3 pools already in local cache. About to get liquidity and slot0s for ${
          poolsToGetTokenPairs.length
        } pools.`
      );
    }

    if (poolsToGetAddresses.length > 0) {
      // Coalesce identical misses. Without this, a pool-cache TTL expiry makes
      // every concurrent quote request fetch the same pool state on-chain.
      const blockNumber = await providerConfig?.blockNumber;
      const fetchKey = `${this.chainId}:${
        blockNumber ?? 'latest'
      }:${poolsToGetAddresses.slice().sort().join(',')}`;

      // Cache writes happen inside the coalesced work so the entry is populated
      // before the single-flight key is released.
      const poolAccessor = await this.inFlight.run(fetchKey, async () => {
        const accessor = await this.poolProvider.getPools(
          poolsToGetTokenPairs,
          providerConfig
        );

        await Promise.all(
          poolsToGetAddresses.map(async (address) => {
            const pool = accessor.getPoolByAddress(address);
            if (pool) {
              await this.cache.set(this.POOL_KEY(this.chainId, address), pool);
            }
          })
        );

        return accessor;
      });

      for (const address of poolsToGetAddresses) {
        const pool = poolAccessor.getPoolByAddress(address);
        if (pool) {
          poolAddressToPool[address] = pool;
        }
      }
    }

    return {
      getPool: (
        tokenA: Token,
        tokenB: Token,
        feeAmount: FeeAmount
      ): Pool | undefined => {
        const { poolAddress } = this.getPoolAddress(tokenA, tokenB, feeAmount);
        return poolAddressToPool[poolAddress];
      },
      getPoolByAddress: (address: string): Pool | undefined =>
        poolAddressToPool[address],
      getAllPools: (): Pool[] => Object.values(poolAddressToPool),
    };
  }

  public getPoolAddress(
    tokenA: Token,
    tokenB: Token,
    feeAmount: FeeAmount
  ): { poolAddress: string; token0: Token; token1: Token } {
    return this.poolProvider.getPoolAddress(tokenA, tokenB, feeAmount);
  }
}
