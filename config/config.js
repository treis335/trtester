// config/config.js — Dexlyn + Spikey cross‑DEX (metadados reais)
const CONFIG = {
  rpc: 'https://rpc-mainnet.supra.com',
  pollingMs: 3500,
  emaAlpha: 0.35,
  tickHistory: 12,
  minProfitPct: 0.09,
  optimalSearch: { min: 10, max: 10000, iterations: 20 },
  scoreWeights: { profit: 0.60, liquidity: 0.25, trend: 0.15 },
  arbLogMax: 8,
  viewTimeout: 11000,
  viewRetries: 3,
  maxConcurrent: 4,

  autoExecute: {
    enabled: true,
    minProfitPct: 0.10,
    minScore: 20,
    gasReserveSUPRA: 0.09,
    cooldownMs: 5000,
    maxConsecutiveFails: 3,
  },

  v3Pools: {
    moduleAddress: '0xc3a610069fa7545cf14e266e849954bf385aca957bb489b1dc069a4baa29b502',
    pools: [
      { address: '0x2d5d69aec278855e633baa332d2d32a486967fc40cd1ff59c4eaf3da66fbc917', tokenA: 'SUPRA', tokenB: 'DEXUSDC' },
      { address: '0x1ff31a624ce0310e3067d695bbdba64c1f0821082e615bfce8d6a9eaca44f4', tokenA: 'SUPRA', tokenB: 'DXLYN' },
      { address: '0x186b999b60a3c88bc3e2b4c1c537519e046f5330a91f024839b2c39e6b391e78', tokenA: 'SUPRA', tokenB: 'STC' },
    ],
  },

  dexes: {
    DEXLYN: {
      moduleAddress: '0xdc694898dff98a1b0447e0992d0413e123ea80da1021d464a4fbaf0265870d8',
      curveTypes: {
        uncorrelated: 'curves::Uncorrelated',
        stable:       'curves::Stable',
      },
      pairs: [
        ['SUPRA',    'DEXUSDC',   'uncorrelated'],
        ['LUCKY',    'SUPRA',     'uncorrelated'],
        ['DAWGZ',    'SUPRA',     'uncorrelated'],
        ['ROBBIE',   'SUPRA',     'uncorrelated'],
        ['JOSH',     'SUPRA',     'uncorrelated'],
        ['SPIKE',    'SUPRA',     'uncorrelated'],
        ['LEO',      'SUPRA',     'uncorrelated'],
        ['MUMMY',    'SUPRA',     'uncorrelated'],
        ['MCB',      'SUPRA',     'uncorrelated'],
        ['PECKY',    'SUPRA',     'uncorrelated'],
        ['CASH',     'SUPRA',     'uncorrelated'],
        ['REPANDA',  'SUPRA',     'uncorrelated'],
        ['LOWCAPS',  'SUPRA',     'uncorrelated'],
        ['BABYJOSH', 'SUPRA',     'uncorrelated'],
        ['TSUPRA',   'SUPRA',     'uncorrelated'],
        ['WABBIT',   'SUPRA',     'uncorrelated'],
        ['NANA',     'SUPRA',     'uncorrelated'],
        ['LUCKY',    'DEXUSDC',   'uncorrelated'],
        ['DAWGZ',    'DEXUSDC',   'uncorrelated'],
        ['CASH',     'DEXUSDC',   'uncorrelated'],
        ['JOSH',     'DEXUSDC',   'uncorrelated'],
        ['OG',       'SUPRA',     'uncorrelated'],
        ['SBC',      'SUPRA',     'uncorrelated'],
        ['MUMMY',    'DEXUSDC',   'uncorrelated'],
        ['SUPDOG',   'SUPRA',     'uncorrelated'],
        ['PUMP',     'SUPRA',     'uncorrelated'],
        ['SHILLBILL','SUPRA',     'uncorrelated'],
        ['FLP',      'SUPRA',     'uncorrelated'],
        ['SUPD',     'SUPRA',     'uncorrelated'],
        ['PECKY',    'DEXUSDC',   'uncorrelated'],
        ['SPIKE',    'DEXUSDC',   'uncorrelated'],
        ['MCB',      'JOSH',      'uncorrelated'],
        ['SPIKE',    'ATMOS',     'uncorrelated'],
        ['ATMOS',    'SUPRA',     'uncorrelated'],
        ['ATMOS',    'DEXUSDC',   'uncorrelated'],
      ],
    },
    ATMOS: {
      moduleAddress: '0x1234567890abcdef1234567890abcdef12345678', // substituir pelo endereço real do módulo ATMOS
      curveTypes: {
        uncorrelated: 'curves::Uncorrelated',
        stable:       'curves::Stable',
      },
      pairs: [
        ['SPIKE',    'ATMOS',     'uncorrelated'],
        ['ATMOS',    'SUPRA',     'uncorrelated'],
        ['ATMOS',    'DEXUSDC',   'uncorrelated'],
      ],
    },
  },
};

module.exports = CONFIG;
