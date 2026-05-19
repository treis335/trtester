// checkToken.js — Extrai o tipo de um Fungible Asset a partir do metadado
const axios = require('axios');

const RPC = 'https://rpc-mainnet.supra.com/rpc/v1';
const METADATA_ADDRESS = process.argv[2] || '0xf11aa44964cfa8396f6519b54cb212915477cfb792c6451a5d79dc6df352e908';

(async () => {
    try {
        const res = await axios.get(`${RPC}/accounts/${METADATA_ADDRESS}`);
        const resources = res.data?.resources || res.data?.data || [];
        console.log(`Recursos no metadado ${METADATA_ADDRESS}:`);
        for (const r of resources) {
            console.log(`  ${r.type}`);
        }
    } catch (e) {
        console.error('Erro:', e.message);
    }
})();