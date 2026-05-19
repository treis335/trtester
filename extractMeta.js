// extractMeta.js — Extrai metadados de todas as pools da Spikey
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const RPC = 'https://rpc-mainnet.supra.com/rpc/v1';
const SPIKEY = '0x3045d27b5fada1e30897a741fb184e48ef0bff3717aea23918ebc1e5c7153083';

async function callView(fn, args = []) {
    const res = await axios.post(`${RPC}/view`, {
        function: `${SPIKEY}::${fn}`,
        type_arguments: [],
        arguments: args,
    });
    return res.data.result;
}

(async () => {
    const pools = JSON.parse(fs.readFileSync('./spikeyPools.json', 'utf8'));
    const metaMap = {};

    for (const pool of pools) {
        const addr = pool.address;
        try {
            const t0 = await callView('amm_pair::token0', [addr]);
            const t1 = await callView('amm_pair::token1', [addr]);
            const meta0 = Array.isArray(t0) && t0[0]?.inner ? t0[0].inner : null;
            const meta1 = Array.isArray(t1) && t1[0]?.inner ? t1[0].inner : null;

            if (meta0 && !metaMap[pool.tokenA]) metaMap[pool.tokenA] = meta0;
            if (meta1 && !metaMap[pool.tokenB]) metaMap[pool.tokenB] = meta1;

            console.log(`${pool.tokenA}/${pool.tokenB}: ${meta0} / ${meta1}`);
        } catch (e) {
            console.log(`Erro em ${addr}: ${e.message}`);
        }
    }

    console.log('\nMetadados encontrados:');
    for (const [symbol, meta] of Object.entries(metaMap)) {
        console.log(`  ${symbol}: ${meta}  ->  type: '${meta}::${symbol.toLowerCase()}::${symbol.toUpperCase()}', decimals: 1e6, symbol: '${symbol}'`);
    }

    fs.writeFileSync('./spikey_metadata.json', JSON.stringify(metaMap, null, 2));
    console.log('\nGuardado em spikey_metadata.json');
})();