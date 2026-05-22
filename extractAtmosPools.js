// extractAtmosPools.js – usando a função callView do bot
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Importa a função callView que já funciona no bot
const callView = require('./utils/callView');

const ATMOS_MODULE = '0xa4a4a31116e114bf3c4f4728914e6b43db73279a4421b0768993e07248fe2234';

// Mapeamento de tokens (ajusta conforme necessário)
const TOKEN_MAP = {
    '0x1::supra_coin::SupraCoin': 'SUPRA',
    '0x8f7d16ade319b0fce368ca6cdb98589c4527ce7f5b51e544a9e68e719934458b::dexusdc::DEXUSDC': 'dexUSDC',
};

async function main() {
    console.log('🔍 A extrair pools da Atmos...');

    // 1. Obter todos os IDs das pools
    let poolIds;
    try {
        poolIds = await callView(ATMOS_MODULE, 'liquidity_pool::get_pools', [], []);
        console.log(`📊 Retornou ${Array.isArray(poolIds) ? poolIds.length : '?'} elementos.`);
    } catch (e) {
        console.error('Erro ao obter get_pools:', e.message);
        console.error('Detalhe:', e.response?.data || e);
        return;
    }

    if (!Array.isArray(poolIds) || poolIds.length === 0) {
        console.log('Nenhuma pool encontrada ou formato inesperado.');
        return;
    }

    // Se o primeiro elemento for também um array, desaninha (caso raro)
    if (poolIds.length > 0 && Array.isArray(poolIds[0])) {
        poolIds = poolIds[0];
        console.log(`Desaninhado: ${poolIds.length} IDs reais.`);
    }

    const pools = [];
    for (let i = 0; i < poolIds.length; i++) {
        const poolId = poolIds[i];
        console.log(`  Processando pool ${i+1}/${poolIds.length}...`);

        // 2. Obter endereço da pool
        let poolAddress;
        try {
            poolAddress = await callView(ATMOS_MODULE, 'liquidity_pool::get_pool_address', [], [poolId]);
        } catch (e) {
            console.error(`  Erro ao obter endereço para ${poolId}:`, e.message);
            continue;
        }
        if (!poolAddress) continue;

        // 3. Obter os tipos das moedas
        let coins;
        try {
            coins = await callView(ATMOS_MODULE, 'liquidity_pool::get_coins', [], [poolAddress]);
        } catch (e) {
            console.error(`  Erro ao obter coins para ${poolAddress}:`, e.message);
            continue;
        }
        if (!coins || coins.length < 2) continue;

        const tokenAStruct = coins[0];
        const tokenBStruct = coins[1];

        const tokenA = TOKEN_MAP[tokenAStruct] || tokenAStruct.split('::').pop();
        const tokenB = TOKEN_MAP[tokenBStruct] || tokenBStruct.split('::').pop();

        pools.push({
            address: poolAddress,
            tokenA: tokenA,
            tokenB: tokenB,
        });
        console.log(`    ✅ ${tokenA}/${tokenB} -> ${poolAddress.slice(0, 18)}...`);
    }

    const simplePools = pools.map(p => ({ address: p.address, tokenA: p.tokenA, tokenB: p.tokenB }));
    fs.writeFileSync('atmosPools.json', JSON.stringify(simplePools, null, 2));
    console.log(`\n🎉 ${pools.length} pools guardadas em atmosPools.json`);
}

main().catch(console.error);