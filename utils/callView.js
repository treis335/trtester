// utils/callView.js — com retry inteligente + cache inteligente (stale-while-revalidate)

const Cache = require('./cache');
const axios = require('axios');
const { CONFIG } = require('../config/config');

// Cache principal com TTL curto (ex.: 2s)
const mainCache = new Cache(CONFIG.RESERVES_CACHE_TTL || 2000);
// Cache de "em actualização" para evitar múltiplos pedidos simultâneos
const pendingCache = new Map();

// Backoff global partilhado: se RPC throttle, todos os pedidos abrandam
let globalBackoffMs = 0;
let lastThrottleTime = 0;

const axiosInstance = axios.create({
  baseURL: CONFIG.rpc,
  timeout: CONFIG.viewTimeout,
});

/**
 * Função interna que faz a chamada real ao RPC.
 * Separa-se para poder ser usada tanto na primeira execução como na revalidação.
 */
async function _fetchFromRpc(moduleAddr, fn, types, args) {
  const fullPath = fn.includes('::')
    ? `${moduleAddr}::${fn}`
    : `${moduleAddr}::router::${fn}`;

  for (let attempt = 0; attempt < CONFIG.viewRetries; attempt++) {
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
      // Sucesso – reduz backoff
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

      if (attempt === CONFIG.viewRetries - 1) throw err;
      const delay = Math.pow(2, attempt) * 400 + Math.random() * 200;
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

/**
 * Função principal que o resto do bot usa.
 * Implementa "stale-while-revalidate": devolve o valor em cache se existir e
 * agenda uma atualização em background, evitando pedidos duplicados.
 */
async function callView(moduleAddr, fn, types = [], args = []) {
  const cacheKey = JSON.stringify({ moduleAddr, fn, types, args });

  // 1. Se existe valor na cache e ainda é válido, usamo-lo.
  const cached = mainCache.get(cacheKey);
  if (cached !== null) {
    // Se a cache ainda tem > 500ms de vida, retorna imediatamente.
    // Caso contrário (está quase a expirar), fazemos refresh em background.
    const age = Date.now() - (cached.timestamp || 0);
    if (age < (CONFIG.RESERVES_CACHE_TTL || 2000) - 500) {
      return cached.value;
    }
    // Está "stale" – vamos revalidar em background.
    if (!pendingCache.has(cacheKey)) {
      pendingCache.set(cacheKey, true);
      _fetchFromRpc(moduleAddr, fn, types, args)
        .then(result => {
          mainCache.set(cacheKey, result);
          pendingCache.delete(cacheKey);
        })
        .catch(() => {
          pendingCache.delete(cacheKey); // se falhar, liberta para nova tentativa
        });
    }
    // Retorna o valor "stale" enquanto o novo não chega.
    return cached.value;
  }

  // 2. Não existe em cache – faz o pedido real (com deduplicação de pedidos simultâneos).
  if (pendingCache.has(cacheKey)) {
    // Já há um pedido em curso, esperar um pouco e tentar ler da cache.
    // (numa versão mais complexa podíamos partilhar a Promise, mas para já este loop resolve)
    for (let i = 0; i < 10; i++) {
      await new Promise(res => setTimeout(res, 200));
      const retryCached = mainCache.get(cacheKey);
      if (retryCached !== null) return retryCached.value;
    }
    // Se após 2s ainda não chegou, fazemos o pedido nós próprios.
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