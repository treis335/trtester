const { CONFIG } = require('../../config/config');
const { logError } = require('../../utils/logError');
const callView = require('../../utils/callView');

const ATMOS = '0xa4a4a31116e114bf3c4f4728914e6b43db73279a4421b0768993e07248fe2234';

const atmosEngine = {
    /**
     * Obtém todos os IDs de pools existentes na Atmos.
     */
    async fetchAllPoolIds() {
        try {
            const result = await callView(ATMOS, 'liquidity_pool::get_pools', [], []);
            return Array.isArray(result) ? result : [];
        } catch (e) {
            logError('atmosAllPools', e);
            return [];
        }
    },

    /**
     * Obtém o endereço de uma pool a partir do seu ID.
     */
    async getPoolAddress(poolId) {
        try {
            const address = await callView(ATMOS, 'liquidity_pool::get_pool_address', [], [poolId]);
            return address ? String(address) : null;
        } catch (e) {
            logError(`atmosGetPoolAddress ${poolId}`, e);
            return null;
        }
    },

    /**
     * Lê o estado de uma pool da Atmos.
     */
    async fetchPairState(poolAddress) {
        try {
            // 1. Obter os metadados dos tokens
            const coins = await callView(ATMOS, 'liquidity_pool::get_coins', [], [poolAddress]);
            if (!coins || !Array.isArray(coins) || coins.length < 2) return null;

            const token0Addr = String(coins[0]);
            const token1Addr = String(coins[1]);

            // Mapear endereços de metadados para símbolos conhecidos
            const symA = this.getSymbolByAddress(token0Addr);
            const symB = this.getSymbolByAddress(token1Addr);
            if (!symA || !symB) return null;

            const tokA = CONFIG.tokens[symA];
            const tokB = CONFIG.tokens[symB];
            if (!tokA || !tokB) return null;

            // 2. Obter reservas
            const balances = await callView(ATMOS, 'liquidity_pool::get_balances', [], [poolAddress]);
            if (!balances || !Array.isArray(balances) || balances.length < 2) return null;

            const reserve0 = Number(balances[0]);
            const reserve1 = Number(balances[1]);
            if (reserve0 === 0 && reserve1 === 0) return null;

            // 3. Obter taxas
            let swapFeeBps = 30; // fallback 0.3%
            try {
                const feeResult = await callView(ATMOS, 'liquidity_pool::get_swap_fee_bps', [], [poolAddress]);
                if (feeResult !== null && feeResult !== undefined) swapFeeBps = Number(feeResult);
            } catch (_) {}

            // 4. Calcular preço
            const amountOut = this.getAmountOut(reserve0, reserve1, tokA.decimals, swapFeeBps, 10000);
            const priceAinB = amountOut / tokB.decimals;

            const engine = this;
            return {
                dex: 'ATMOS',
                tokenA: symA,
                tokenB: symB,
                curve: 'constant_product',
                pairAddress: poolAddress,
                reserveA: reserve0,
                reserveB: reserve1,
                fee: swapFeeBps,
                feeScale: 10000,
                priceAinB: isNaN(priceAinB) ? 0 : priceAinB,
                _simulate: (direction, amountIn) => engine.simulateTrade(
                    { tokenA: symA, tokenB: symB, reserveA: reserve0, reserveB: reserve1, fee: swapFeeBps, feeScale: 10000 },
                    direction, amountIn
                ),
            };
        } catch (e) {
            logError(`fetchAtmosPair ${poolAddress}`, e);
            return null;
        }
    },

    getSymbolByAddress(moduleAddress) {
        if (!moduleAddress) return null;
        for (const [symbol, tok] of Object.entries(CONFIG.tokens)) {
            if (tok.type.startsWith(moduleAddress + '::')) {
                return symbol;
            }
        }
        return null;
    },

    simulateTrade(ps, direction, amountIn) {
        const decA = CONFIG.tokens[ps.tokenA]?.decimals || 1e6;
        const decB = CONFIG.tokens[ps.tokenB]?.decimals || 1e6;
        if (direction === 'AB') {
            const raw = this.getAmountOut(ps.reserveA, ps.reserveB, amountIn * decA, ps.fee, ps.feeScale);
            return raw / decB;
        } else {
            const raw = this.getAmountOut(ps.reserveB, ps.reserveA, amountIn * decB, ps.fee, ps.feeScale);
            return raw / decA;
        }
    },

    getAmountOut(reserveIn, reserveOut, amountIn, fee, feeScale) {
        if (reserveIn <= 0 || reserveOut <= 0 || amountIn <= 0) return 0;
        const feeMul = BigInt(feeScale - fee);
        const afterFee = (BigInt(Math.floor(amountIn)) * feeMul) / BigInt(feeScale);
        if (afterFee <= 0n) return 0;
        return Number((afterFee * BigInt(Math.floor(reserveOut))) / (BigInt(Math.floor(reserveIn)) + afterFee));
    },
};

module.exports = atmosEngine;