import { Token } from '@uniswap/sdk-core';

import {
  IV3PoolProvider,
  V3PoolAccessor,
} from '../../../../src/providers/v3/pool-provider';
import { StaticV3SubgraphProvider } from '../../../../src/providers/v3/static-subgraph-provider';
import { ChainId } from '../../../../src/util/chains';

const WETH = new Token(
  ChainId.MAINNET,
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  18
);
const USDC = new Token(
  ChainId.MAINNET,
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  6
);
const DAI = new Token(
  ChainId.MAINNET,
  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  18
);

const emptyAccessor: V3PoolAccessor = {
  getPool: () => undefined,
  getPoolByAddress: () => undefined,
  getAllPools: () => [],
};

class CountingPoolProvider implements IV3PoolProvider {
  public calls = 0;

  public async getPools(): Promise<V3PoolAccessor> {
    this.calls++;
    return emptyAccessor;
  }

  public getPoolAddress() {
    return { poolAddress: '0x0', token0: WETH, token1: USDC };
  }
}

describe('StaticV3SubgraphProvider', () => {
  it('reuses the on-chain pool list for a repeated token pair', async () => {
    const poolProvider = new CountingPoolProvider();
    const provider = new StaticV3SubgraphProvider(
      ChainId.MAINNET,
      poolProvider
    );

    await provider.getPools(WETH, USDC);
    await provider.getPools(WETH, USDC);

    expect(poolProvider.calls).toBe(1);
  });

  it('keeps a separate entry per token pair', async () => {
    const poolProvider = new CountingPoolProvider();
    const provider = new StaticV3SubgraphProvider(
      ChainId.MAINNET,
      poolProvider
    );

    await provider.getPools(WETH, USDC);
    await provider.getPools(WETH, DAI);

    expect(poolProvider.calls).toBe(2);
  });

  it('reuses the base-token list when no pair is given', async () => {
    const poolProvider = new CountingPoolProvider();
    const provider = new StaticV3SubgraphProvider(
      ChainId.MAINNET,
      poolProvider
    );

    await provider.getPools();
    await provider.getPools();

    expect(poolProvider.calls).toBe(1);
  });

  it('does not mix the pair-scoped list with the base-token list', async () => {
    const poolProvider = new CountingPoolProvider();
    const provider = new StaticV3SubgraphProvider(
      ChainId.MAINNET,
      poolProvider
    );

    await provider.getPools();
    await provider.getPools(WETH, USDC);
    await provider.getPools();

    expect(poolProvider.calls).toBe(2);
  });
});
