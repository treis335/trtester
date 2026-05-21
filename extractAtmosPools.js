// extractAtmosPools.js — Extrai todas as pools da Atmos
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const RPC = 'https://rpc-mainnet.supra.com/rpc/v1';
const ATMOS = '0xa4a4a31116e114bf3c4f4728914e6b43db73279a4421b0768993e07248fe2234';

// Mapeamento de símbolos (do teu config.js)
const KNOWN_TOKENS = {
    '0x1': { symbol: 'SUPRA', decimals: 1e8 },
    '0x8f7d16ade319b0fce368ca6cdb98589c4527ce7f5b51e544a9e68e719934458b': { symbol: 'dexUSDC', decimals: 1e6 },
    // Adiciona outros tokens que possam aparecer...
};

async function callView(fn, args = []) {
    const res = await axios.post(`${RPC}/view`, {
        function: `${ATMOS}::${fn}`,
        type_arguments: [],
        arguments: args,
    });
    return res.data.result;
}

async function getSymbol(metadataAddr) {
    const addr = String(metadataAddr);
    if (KNOWN_TOKENS[addr]) return KNOWN_TOKENS[addr].symbol;
    // Tenta obter o símbolo via RPC (opcional)
    return null;
}

(async () => {
    console.log('🔍 A extrair pools da Atmos...');
    const poolIds = await callView('liquidity_pool::get_pools');
    if (!Array.isArray(poolIds)) {
        console.log('Nenhuma pool encontrada ou formato inesperado.');
        return;
    }
    console.log(`${poolIds.length} pools encontradas.`);

    const pools = [];
    for (const id of poolIds) {
        const addr = await callView('liquidity_pool::get_pool_address', [id]);
        if (!addr) continue;
        const coins = await callView('liquidity_pool::get_coins', [addr]);
        if (!coins || coins.length < 2) continue;
        const symA = await getSymbol(coins[0]);
        const symB = await getSymbol(coins[1]);
        if (!symA || !symB) continue;
        pools.push({ address: String(addr), tokenA: symA, tokenB: symB });
        console.log(`  ${symA}/${symB}: ${addr}`);
    }

    fs.writeFileSync('atmosPools.json', JSON.stringify(pools, null, 2));
    console.log(`\n${pools.length} pools guardadas em atmosPools.json`);
})();