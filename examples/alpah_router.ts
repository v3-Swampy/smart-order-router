// import ethersLogger from '@ethersproject/logger';
import { AlphaRouter, CurrencyAmount, setGlobalLogger } from '../src/index';
import { Protocol } from '@uniswap/router-sdk';
import { TradeType, Token } from '@uniswap/sdk-core';
import { ethers } from 'ethers';
import bunyan from 'bunyan';
import 'source-map-support/register';

Error.stackTraceLimit = Infinity;
// ethersLogger.Logger.globalLogger();
// ethersLogger.Logger.setLogLevel(ethersLogger.Logger.levels.DEBUG);
setGlobalLogger(bunyan.createLogger({
  name: 'Alpah Example',
  serializers: bunyan.stdSerializers,
  level: bunyan.INFO,
}));

async function testRouter(): Promise<void> {
  const chainId = 1030;
  const provider = new ethers.providers.JsonRpcProvider('https://evm.confluxrpc.com');
  const tokenA = new Token(1030, '0x14b2d3bc65e74dae1030eafd8ac30c533c976a9b', 18, 'WCFX', 'WCFX');
  // const tokenB = new Token(1030, '0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff', 6, 'USDT0', 'USDT0');
  const tokenB = new Token(1030, '0x70bfd7f7eadf9b9827541272589a6b2bb760ae2e', 6, 'AXCNH', 'AXCNH');
  // const tokenB = new Token(1030, '0xfe97e85d13abd9c1c33384e796f10b73905637ce', 18, 'USDT', 'USDT');
  const amountInRaw = (ethers.utils.parseEther("5000")).toString();

  // const chainId = 71;
  // const provider = new ethers.providers.JsonRpcProvider('https://evmtestnet.confluxrpc.com');
  // const tokenA = new Token(71, '0x54593e02c39aeff52b166bd036797d2b1478de8d', 18, 'BTC', 'BTC');
  // const tokenB = new Token(71, '0x7d682e65efc5c13bf4e394b8f376c48e6bae0355', 18, 'USDT', 'USDT');
  // const amountInRaw = (ethers.utils.parseEther("1")).toString();

  // 提供一个空的 V2 Provider，避免在不支持的链上触发 V2 工厂地址计算
  const emptyV2Provider: any = {
    getPools: async () => ({
      getPool: () => undefined,
      getPoolByAddress: () => undefined,
      getAllPools: () => [],
    }),
    getPoolAddress: (tokenA: Token, tokenB: Token) => {
      const [t0, t1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];
      return { poolAddress: ethers.constants.AddressZero, token0: t0, token1: t1 };
    },
  };

  const router = new AlphaRouter({
    chainId,
    provider,
    v2PoolProvider: emptyV2Provider,
  });

  console.log('created router');

  const bestRouter = await router.route(
    CurrencyAmount.fromRawAmount(tokenA, amountInRaw),
    tokenB,
    TradeType.EXACT_INPUT,
    undefined,
    { protocols: [Protocol.V3] }
  );

  console.log('bestRouter', formatCurrencyAmount(bestRouter?.quote));
}

function formatCurrencyAmount(amount?: CurrencyAmount): string {
  if (!amount) return '-';
  const symbol = amount.currency?.symbol ?? '';
  // 6 位有效数字更易读，也可改成 toExact()
  return `${amount.toSignificant ? amount.toSignificant(6) : String(amount)} ${symbol}`;
}


// process.on('uncaughtException', (err, origin) => {
//   console.error(
//     'Caught exception:\n', err,
//     '\nException origin:', origin
//   );
// }).on('unhandledRejection', (reason, p) => {
//   // p.catch(err => console.log("error of promise:", reason, "stack:", err && err.stack));
//   console.error(
//     'Unhandled Rejection:\n', reason, '\n',
//     'Rejection of promise:\n', p
//   );
// });


testRouter();

