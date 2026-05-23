// dexes/dexlyn/dexlynEngine.js
const callView = require('../../utils/callView');
const { logError } = require('../../utils/logError');

// Carrega CONFIG de forma segura
let CONFIG = {};
try {
  const configModule = require('../../config/config');
  CONFIG = configModule.CONFIG || {};
} catch (e) {
  console.warn('⚠️ dexlynEngine: config não carregado. Usa valores padrão.');
}

const MODULE_ADDRESS = CONFIG?.dexes?.DEXLYN?.moduleAddress ||
  '0xdc694898dff98a1b0447e0992d0413e123ea80da1021d464a4fbaf0265870d8';

const dexlynEngine = {
  async fetchPairState(dexKey, tokenA, tokenB, curve) {
    try {
      const moduleAddr = MODULE_ADDRESS;
      const curvePath = (CONFIG?.dexes?.DEXLYN?.curveTypes?.[curve]) || 'curves::Uncorrelated';
      const fullCurve = `${moduleAddr}::${curvePath}`;

      const poolAddr = await this.getPoolAddress(moduleAddr, tokenA, tokenB, fullCurve);
      if (!poolAddr) return null;

      const reserves = await this.getReserves(moduleAddr, poolAddr);
      if (!reserves) return null;

      const fee = 30; // 0.3%
      const feeScale = 10000;
      const decA = CONFIG?.tokens?.[tokenA]?.decimals || 1e6;
      const decB = CONFIG?.tokens?.[tokenB]?.decimals || 1e6;

      const amountOut = this.getAmountOut(Number(reserves.reserve0), Number(reserves.reserve1), decA, fee, feeScale);
      const priceAinB = amountOut / decB;

      const engine = this;
      return {
        dex: dexKey || 'DEXLYN',
        tokenA,
        tokenB,
        curve,
        pairAddress: poolAddr,
        reserveA: Number(reserves.reserve0),
        reserveB: Number(reserves.reserve1),
        fee,
        feeScale,
        priceAinB: isNaN(priceAinB) ? 0 : priceAinB,
        _simulate: (direction, amountIn) =>
          engine.simulateTrade(
            {
              tokenA,
              tokenB,
              reserveA: Number(reserves.reserve0),
              reserveB: Number(reserves.reserve1),
              fee,
              feeScale,
            },
            direction,
            amountIn
          ),
      };
    } catch (e) {
      logError(`fetchPairState ${tokenA}/${tokenB}`, e);
      return null;
    }
  },

  async getPoolAddress(moduleAddr, tokenA, tokenB, curveFull) {
    try {
      // Tenta obter o endereço da pool via view function
      const result = await callView(moduleAddr, 'get_pool_address_ct_ct', [], []);
      // O resultado pode ser um endereço; se não existir, retorna null
      return typeof result === 'string' ? result : null;
    } catch (e) {
      logError(`getPoolAddress ${tokenA}/${tokenB}`, e);
      return null;
    }
  },

  async getReserves(moduleAddr, poolAddr) {
    try {
      const result = await callView(moduleAddr, 'get_pool_reserves', [], [poolAddr]);
      if (Array.isArray(result) && result.length >= 2) {
        return {
          reserve0: BigInt(result[0]),
          reserve1: BigInt(result[1]),
        };
      }
      return null;
    } catch (e) {
      logError(`getReserves ${poolAddr}`, e);
      return null;
    }
  },

  getAmountOut(reserveIn, reserveOut, amountIn, fee, feeScale) {
    if (reserveIn <= 0 || reserveOut <= 0 || amountIn <= 0) return 0;
    const feeMul = BigInt(feeScale - fee);
    const amountInBig = BigInt(Math.floor(amountIn));
    const reserveInBig = BigInt(Math.floor(reserveIn));
    const reserveOutBig = BigInt(Math.floor(reserveOut));
    const afterFee = (amountInBig * feeMul) / BigInt(feeScale);
    if (afterFee <= 0n) return 0;
    return Number((afterFee * reserveOutBig) / (reserveInBig + afterFee));
  },

  simulateTrade(pairState, direction, amountIn) {
    const decA = CONFIG?.tokens?.[pairState.tokenA]?.decimals || 1e6;
    const decB = CONFIG?.tokens?.[pairState.tokenB]?.decimals || 1e6;
    if (direction === 'AB') {
      const raw = this.getAmountOut(pairState.reserveA, pairState.reserveB, amountIn * decA, pairState.fee, pairState.feeScale);
      return raw / decB;
    } else {
      const raw = this.getAmountOut(pairState.reserveB, pairState.reserveA, amountIn * decB, pairState.fee, pairState.feeScale);
      return raw / decA;
    }
  },
};

module.exports = dexlynEngine;