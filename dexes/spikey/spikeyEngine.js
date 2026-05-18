const axios = require('axios');
const { CONFIG } = require('../../config/config');
const { logError } = require('../../utils/logError');
const callView = require('../../utils/callView');

const SPIKEY_ADDRESS = '0x3045d27b5fada1e30897a741fb184e48ef0bff3717aea23918ebc1e5c7153083';

const spikeyEngine = {
    async fetchAllPairAddresses() {
        try {
            const result = await callView(SPIKEY_ADDRESS, 'amm_factory::all_pairs', [], []);
            if (Array.isArray(result)) return result;
            if (result && Array.isArray(result.result)) return result.result;
            return [];
        } catch (e) {
            logError('spikeyAllPairs', e);
            return [];
        }
    },

    async fetchPairState(poolAddress) {
        try {
            const response = await axios.get(
                `${CONFIG.rpc}/rpc/v1/accounts/${poolAddress}`,
                { timeout: CONFIG.viewTimeout }
            );
            const resources = response.data?.resources || response.data?.data || [];

            const pairResource = resources.find(r =>
                r.type && r.type.includes('amm_pair') && r.type.includes('Pair')
            );

            if (!pairResource || !pairResource.data) return null;

            const data = pairResource.data;
            const reserve0 = BigInt(data.reserve0 ?? 0);
            const reserve1 = BigInt(data.reserve1 ?? 0);
            const token0Addr = data.token0?.inner ?? data.token0 ?? '';
            const token1Addr = data.token1?.inner ?? data.token1 ?? '';

            if (reserve0 === 0n && reserve1 === 0n) return null;

            const tokenA = this.getSymbolByAddress(token0Addr);
            const tokenB = this.getSymbolByAddress(token1Addr);
            if (!tokenA || !tokenB) return null;

            let swapFee = 30;
            try {
                const feeResult = await callView(SPIKEY_ADDRESS, 'amm_controller::get_swap_fee', [], []);
                if (feeResult !== null && feeResult !== undefined && !isNaN(Number(feeResult))) {
                    swapFee = Number(feeResult);
                }
            } catch (_) {}

            const feeScale = 10000;
            const tokA = CONFIG.tokens[tokenA];
            const tokB = CONFIG.tokens[tokenB];
            if (!tokA || !tokB) return null;

            const amountOut = this.getAmountOut(reserve0, reserve1, BigInt(tokA.decimals), swapFee, feeScale);
            const priceAinB = Number(amountOut) / tokB.decimals;

            return {
                dex: 'SPIKEY',
                tokenA,
                tokenB,
                curve: 'constant_product',
                pairAddress: poolAddress,
                reserveA: Number(reserve0),
                reserveB: Number(reserve1),
                fee: swapFee,
                feeScale,
                priceAinB,
            };
        } catch (e) {
            logError(`fetchSpikeyPair ${poolAddress}`, e);
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
        const tokA = CONFIG.tokens[ps.tokenA] || { decimals: 1e6 };
        const tokB = CONFIG.tokens[ps.tokenB] || { decimals: 1e6 };
        if (amountIn <= 0) return 0;
        const reserveIn = direction === 'AB' ? ps.reserveA : ps.reserveB;
        const reserveOut = direction === 'AB' ? ps.reserveB : ps.reserveA;
        const decimalsIn = direction === 'AB' ? tokA.decimals : tokB.decimals;
        const decimalsOut = direction === 'AB' ? tokB.decimals : tokA.decimals;

        const raw = this.getAmountOut(
            BigInt(Math.floor(reserveIn)),
            BigInt(Math.floor(reserveOut)),
            BigInt(Math.floor(amountIn * decimalsIn)),
            ps.fee,
            ps.feeScale
        );
        return Number(raw) / decimalsOut;
    },

    getAmountOut(reserveIn, reserveOut, amountIn, fee, feeScale) {
        if (reserveIn <= 0n || reserveOut <= 0n || amountIn <= 0n) return 0n;
        const feeMul = BigInt(feeScale - fee);
        const afterFee = (amountIn * feeMul) / BigInt(feeScale);
        if (afterFee <= 0n) return 0n;
        return (afterFee * reserveOut) / (reserveIn + afterFee);
    },
};

module.exports = spikeyEngine;