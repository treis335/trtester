const CONFIG = {
  "rpc": "https://rpc-mainnet.supra.com",
  "pollingMs": 3500,
  "emaAlpha": 0.35,
  "tickHistory": 12,
  "minProfitPct": 0.05,
  "optimalSearch": {
    "min": 10,
    "max": 10000,
    "iterations": 20
  },
  "scoreWeights": {
    "profit": 0.6,
    "liquidity": 0.25,
    "trend": 0.15
  },
  "arbLogMax": 8,
  "viewTimeout": 11000,
  "viewRetries": 3,
  "maxConcurrent": 4,
  "RESERVES_CACHE_TTL": 2000,
  "SLIPPAGE_DYNAMIC": true,
  "MIN_VOLUME_24H": 100,
  "MIN_SPREAD": 0.0001,
  "MAX_HOPS": 4,
  "PROFIT_GAS_RATIO_MIN": 1.5,
  "autoExecute": {
    "enabled": true,
    "minProfitPct": 0.05,
    "minScore": 15,
    "gasReserveSUPRA": 0.09,
    "cooldownMs": 5000,
    "maxConsecutiveFails": 3
  },
  "dexes": {
    "DEXLYN": {
      "moduleAddress": "0xdc694898dff98a1b0447e0992d0413e123ea80da1021d464a4fbaf0265870d8",
      "curveTypes": {
        "uncorrelated": "curves::Uncorrelated",
        "stable": "curves::Stable"
      },
      "pairs": [
        ["SUPRA", "DEXUSDC", "uncorrelated"],
        ["LUCKY", "SUPRA", "uncorrelated"],
        ["DAWGZ", "SUPRA", "uncorrelated"],
        ["ROBBIE", "SUPRA", "uncorrelated"],
        ["JOSH", "SUPRA", "uncorrelated"],
        ["SPIKE", "SUPRA", "uncorrelated"],
        ["LEO", "SUPRA", "uncorrelated"],
        ["MUMMY", "SUPRA", "uncorrelated"],
        ["MCB", "SUPRA", "uncorrelated"],
        ["PECKY", "SUPRA", "uncorrelated"],
        ["CASH", "SUPRA", "uncorrelated"],
        ["REPANDA", "SUPRA", "uncorrelated"],
        ["LOWCAPS", "SUPRA", "uncorrelated"],
        ["BABYJOSH", "SUPRA", "uncorrelated"],
        ["TSUPRA", "SUPRA", "uncorrelated"],
        ["WABBIT", "SUPRA", "uncorrelated"],
        ["NANA", "SUPRA", "uncorrelated"],
        ["LUCKY", "DEXUSDC", "uncorrelated"],
        ["DAWGZ", "DEXUSDC", "uncorrelated"],
        ["CASH", "DEXUSDC", "uncorrelated"],
        ["JOSH", "DEXUSDC", "uncorrelated"],
        ["OG", "SUPRA", "uncorrelated"],
        ["SBC", "SUPRA", "uncorrelated"],
        ["MUMMY", "SUPRA", "uncorrelated"]
      ]
    }
  }
};