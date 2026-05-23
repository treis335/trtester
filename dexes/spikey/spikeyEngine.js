// dexes/spikey/spikeyEngine.js
const callView = require('../../utils/callView');
const { logError } = require('../../utils/logError');
const { CONFIG } = require('../../config/config');
const Cache = require('../../utils/cache');

const MODULE_ADDRESS = '0xa4a4a31116e114bf3c4f4728914e6b43db73279a4421b0768993e07248fe2234';
const reservesCache = new Cache(2000);

const spikeyEngine = {
  async getReserves(poolAddr) {
    try {
      const result = await callView(MODULE_ADDRESS, 'get_pool_reserves', [], [poolAddr]);
      const reserves = {
        reserve0: BigInt(result[0]),
        reserve1: BigInt(result[1]),
      };
      return reserves;
    } catch (e) {
      logError(`spikeyGetReserves ${poolAddr}`, e);
      // Retorna reservas 0 para ser filtrado mais tarde
      return { reserve0: 0n, reserve1: 0n };
    }
  },

  async getAmountOut(amountIn, metaIn, metaOut) {
    try {
      const result = await callView(MODULE_ADDRESS, 'get_amount_out', [], [amountIn.toString(), metaIn, metaOut]);
      return BigInt(result[0]);
    } catch (e) {
      logError(`spikeyGetAmountOut`, e);
      return 0n;
    }
  },

  async fetchPairState(poolAddr, tokenA, tokenB) {
    try {
      const reserves = await this.getReserves(poolAddr);
      const fee = 30;
      const feeScale = 10000;
      const decA = CONFIG.tokens[tokenA]?.decimals || 1e6;
      const decB = CONFIG.tokens[tokenB]?.decimals || 1e6;
      const amountOut = this.getAmountOutLocal(decA, Number(reserves.reserve0), Number(reserves.reserve1), fee, feeScale);
      const priceAinB = amountOut / decB;
      const engine = this;
      return {
        dex: 'SPIKEY',
        tokenA: tokenA,
        tokenB: tokenB,
        curve: 'constant_product',
        pairAddress: poolAddr,
        reserveA: Number(reserves.reserve0),
        reserveB: Number(reserves.reserve1),
        fee,
        feeScale,
        priceAinB: isNaN(priceAinB) ? 0 : priceAinB,
        _simulate: (direction, amountIn) => engine.simulateTrade(
          { tokenA, tokenB, reserveA: Number(reserves.reserve0), reserveB: Number(reserves.reserve1), fee, feeScale },
          direction, amountIn
        ),
      };
    } catch (e) {
      logError(`spikeyFetchPairState ${poolAddr}`, e);
      return null;
    }
  },

  getAmountOutLocal(reserveIn, reserveOut, amountIn, fee, feeScale) {
    if (!isFinite(reserveIn) || !isFinite(reserveOut) || !isFinite(amountIn)) return 0;
    if (reserveIn <= 0 || reserveOut <= 0 || amountIn <= 0) return 0;
    const feeMul = BigInt(Math.floor(feeScale - fee));
    const amountInBig = BigInt(Math.floor(amountIn));
    const reserveInBig = BigInt(Math.floor(reserveIn));
    const reserveOutBig = BigInt(Math.floor(reserveOut));
    const afterFee = (amountInBig * feeMul) / BigInt(Math.floor(feeScale));
    if (afterFee <= 0n) return 0;
    return Number((afterFee * reserveOutBig) / (reserveInBig + afterFee));
  },

  simulateTrade(ps, direction, amountIn) {
    const decA = CONFIG.tokens[ps.tokenA]?.decimals || 1e6;
    const decB = CONFIG.tokens[ps.tokenB]?.decimals || 1e6;
    if (direction === 'AB') {
      const raw = this.getAmountOutLocal(ps.reserveA, ps.reserveB, amountIn * decA, ps.fee, ps.feeScale);
      return raw / decB;
    } else {
      const raw = this.getAmountOutLocal(ps.reserveB, ps.reserveA, amountIn * decB, ps.fee, ps.feeScale);
      return raw / decA;
    }
  },
};

module.exports = spikeyEngine;          