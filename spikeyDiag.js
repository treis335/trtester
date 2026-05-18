// spikeyDiag.js
require('dotenv').config();
const axios = require('axios');
const RPC = 'https://rpc-mainnet.supra.com/rpc/v1';
const SPIKEY = '0x3045d27b5fada1e30897a741fb184e48ef0bff3717aea23918ebc1e5c7153083';
const POOL = '0x3eb42ab2a600633e3c30911464c5b07d5a486314de7b0e16ed161754489ae6ef';
(async () => {
    const callView = async (fn, args = []) => (await axios.post(`${RPC}/view`, { function: `${SPIKEY}::${fn}`, type_arguments: [], arguments: args })).data.result;
    const t0 = await callView('amm_pair::token0', [POOL]);
    const t1 = await callView('amm_pair::token1', [POOL]);
    const reserves = await callView('amm_pair::get_reserves', [POOL]);
    console.log('token0:', JSON.stringify(t0));
    console.log('token1:', JSON.stringify(t1));
    console.log('reserves:', reserves);
})();