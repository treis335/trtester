// utils/callView.js — versão blindada (imune a config partido)

const Cache = require('./cache');
const axios = require('axios');

// ⚠️ NUNCA depender do CONFIG. Valores padrão absolutos.
let CONFIG = {};
try {
  // Tenta carregar, mas se falhar usa objecto vazio
  const configModule = require('../config/config');
  CONFIG = configModule.CONFIG || {};
} catch (e) {
  console.warn('⚠️ callView: não foi possível carregar config. A usar valores padrão.');
}

const CACHE_TTL = CONFIG.RESERVES_CACHE_TTL || 2000;
const VIEW_TIMEOUT = CONFIG.viewTimeout || 11000;
const VIEW_RETRIES = CONFIG.viewRetries || 3;
const RPC_URL = CONFIG.rpc || 'https://rpc-mainnet.supra.com';

const mainCache = new Cache(CACHE_TTL);
const pendingCache = new Map();

let globalBackoffMs = 0;
let lastThrottleTime = 0;

const axiosInstance = axios.create({
  baseURL: RPC_URL,
  timeout: VIEW_TIMEOUT,
});

async function _fetchFromRpc(moduleAddr, fn, types, args) {
  const fullPath = fn.includes('::')
    ? `${moduleAddr}::${fn}`
    : `${moduleAddr}::router::${fn}`;

  for (let attempt = 0; attempt < VIEW_RETRIES; attempt++) {
    if (globalBackoffMs > 0) {
      const elapsed = Date.now() - lastThrottleTime;
      const remaining = globalBackoffMs - elapsed;
      if (remaining > 0) await new Promise(res => setTimeout(res, remaining));
    }

    try {
      const r = await axiosInstance.post('/rpc/v1/view', {
        function: fullPath,
        type_arguments: types,
        arguments: args,
      });

      const result = r.data.result ?? r.data;
      if (globalBackoffMs > 0) globalBackoffMs = Math.max(0, globalBackoffMs - 200);
      return result;

    } catch (err) {
      const status = err?.response?.status;

      if (status === 429) {
        globalBackoffMs = Math.min(5000, (globalBackoffMs || 500) * 2);
        lastThrottleTime = Date.now();
        const waitMs = globalBackoffMs + Math.random() * 300;
        await new Promise(res => setTimeout(res, waitMs));
        attempt--;
        if (attempt < -5) throw err;
        continue;
      }

      if (attempt === VIEW_RETRIES - 1) throw err;
      const delay = Math.pow(2, attempt) * 400 + Math.random() * 200;
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

async function callView(moduleAddr, fn, types = [], args = []) {
  const cacheKey = JSON.stringify({ moduleAddr, fn, types, args });
  const cached = mainCache.get(cacheKey);
  if (cached !== null) {
    const age = Date.now() - (cached.timestamp || 0);
    if (age < CACHE_TTL - 500) return cached.value;
    if (!pendingCache.has(cacheKey)) {
      pendingCache.set(cacheKey, true);
      _fetchFromRpc(moduleAddr, fn, types, args)
        .then(result => { mainCache.set(cacheKey, result); pendingCache.delete(cacheKey); })
        .catch(() => { pendingCache.delete(cacheKey); });
    }
    return cached.value;
  }

  if (pendingCache.has(cacheKey)) {
    for (let i = 0; i < 10; i++) {
      await new Promise(res => setTimeout(res, 200));
      const retryCached = mainCache.get(cacheKey);
      if (retryCached !== null) return retryCached.value;
    }
  }

  pendingCache.set(cacheKey, true);
  try {
    const result = await _fetchFromRpc(moduleAddr, fn, types, args);
    mainCache.set(cacheKey, result);
    pendingCache.delete(cacheKey);
    return result;
  } catch (err) {
    pendingCache.delete(cacheKey);
    throw err;
  }
}

module.exports = callView;