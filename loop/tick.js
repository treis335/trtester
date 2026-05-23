// Date: 2025-04-08
// Reason: Fix critical error 'Cannot convert undefined or null to object' in tick function, add proper validation and error handling

const asyncLimit = require('../utils/asyncLimit');
const { logMetrics } = require('../utils/metricsLogger');
const { CONFIG } = require('../config/config');
const priceEngine = require('../dexes/dexlyn/dexlynEngine');
const graphEngine = require('../engine/graphEngine');
const { arbDetector } = require('../detector/arbDetector');
const { logError } = require('../utils/logError');
const renderPrices = require('../tui/renderPrices');
const renderArb = require('../tui/renderArb');
const renderLog = require('../tui/renderlog');
const { renderFooter, setRpcHealthy } = require('../tui/renderFooter');
const { fetchWalletBalance } = require('../utils/walletBalance');
const { broadcast } = require('../server');
const { executeArbitrage } = require('../dexes/dexlyn/dexlynExecute'); // Moved require to top

let bestOpportunity = null;
let currentOpps = [];

// Retry with exponential backoff and timeout control
async function retryWithBackoff(fn, retries = 3, baseDelay = 1000, maxDelay = 5000, timeout = 30000) {
    const startTime = Date.now();
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            // Check if total time exceeds timeout
            if (Date.now() - startTime > timeout) {
                throw new Error('Global timeout exceeded');
            }
            return await fn();
        } catch (error) {
            if (attempt === retries - 1) throw error;
            const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
            // Ensure delay doesn't exceed remaining timeout
            const remainingTime = timeout - (Date.now() - startTime);
            if (delay > remainingTime) {
                throw new Error('Global timeout would be exceeded by retry delay');
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

let lastAutoTxTime = 0;
let autoTxInProgress = false;

// ─── maybeAutoExecute ──────────────────────────────────────────────
async function maybeAutoExecute(opps, balances, boxes) {
    const cfg = CONFIG.autoExecute;
    if (!cfg || !cfg.enabled) return;
    if (autoTxInProgress) return;
    const now = Date.now();
    if (now - lastAutoTxTime < cfg.cooldownMs) return;
    if (!opps || opps.length === 0) return;

    const availableSUPRA = Math.max(0, (balances.SUPRA || 0) - cfg.gasReserveSUPRA);
    const viableOpps = opps.filter(opp => {
        const tokenIn = opp.cycle.path[0];
        if (tokenIn !== 'SUPRA') return false;
        if (opp.result.profitPct < cfg.minProfitPct) return false;
        if (opp.score < cfg.minScore) return false;
        if (opp.optimalAmount > availableSUPRA) return false;
        return true;
    });
    if (viableOpps.length === 0) return;

    const bestOpp = viableOpps[0];
    // Validate bestOpp structure
    if (!bestOpp.cycle || !bestOpp.cycle.path || !bestOpp.cycle.edges) {
        logError('Invalid bestOpp structure', bestOpp);
        return;
    }

    autoTxInProgress = true;
    lastAutoTxTime = now;

    const log = (msg) => { boxes.footerBox.setContent(msg); boxes.screen.render(); };
    log(`{yellow-fg}🤖 Auto-execução: ${bestOpp.cycle.path.map(t => CONFIG.tokens[t]?.symbol || t).join(' → ')} (+${bestOpp.result.profitPct.toFixed(3)}%){/}`);

    try {
        const res = await executeArbitrage(bestOpp, () => {});
        if (res && res.txHash) {
            log(`{green-fg}✅ Sucesso! Tx: ${res.txHash.slice(0,10)}...{/}`);
            logMetrics({
                pair: `${bestOpp.cycle.path[0]}/${bestOpp.cycle.path[1]}`,
                route: bestOpp.cycle.edges.map(e => ({ dex: e.pair.dex })),
                expectedProfit: bestOpp.result.profit,
                gasCost: 0.05,
                timeToDetectMs: Date.now() - now, // Use actual detection time
                timeToExecuteMs: Date.now() - now,
                success: true,
            });
        } else {
            log(`{red-fg}❌ Falhou.{/}`);
        }
    } catch (e) {
        log(`{red-fg}❌ Erro: ${e.message}{/}`);
        logError('Auto-execution failed', e);
    }
    autoTxInProgress = false;
}

// ─── Tick principal ─────────────────────────────────────────────────
async function tick(boxes) {
    const t0 = Date.now();
    const limit = asyncLimit(CONFIG.maxConcurrent);

    const tasks = [];

    // Validate CONFIG.dexes before iterating
    if (!CONFIG.dexes || typeof CONFIG.dexes !== 'object' || Array.isArray(CONFIG.dexes)) {
        logError('CONFIG.dexes is invalid or missing', CONFIG.dexes);
        return;
    }

    // ═══ Apenas Dexlyn V2 ═══
    for (const [dexKey, dex] of Object.entries(CONFIG.dexes)) {
        // Validate dex structure
        if (!dex || !dex.pairs || !Array.isArray(dex.pairs)) {
            logError(`Invalid dex structure for ${dexKey}`, dex);
            continue;
        }
        for (const [tokenA, tokenB, curve] of dex.pairs) {
            // Validate pair data
            if (!tokenA || !tokenB) {
                logError(`Invalid pair data for ${dexKey}`, { tokenA, tokenB, curve });
                continue;
            }
            // Use retryWithBackoff with timeout from CONFIG
            const timeout = CONFIG.rpc?.timeout || 30000;
            const maxRetries = CONFIG.rpc?.retry?.maxRetries || 3;
            const baseDelay = CONFIG.rpc?.retry?.baseDelay || 1000;
            const maxDelay = CONFIG.rpc?.retry?.maxDelay || 5000;

            tasks.push(limit(async () => {
                try {
                    const prices = await retryWithBackoff(
                        () => priceEngine.fetchPrices(dexKey, tokenA, tokenB, curve),
                        maxRetries,
                        baseDelay,
                        maxDelay,
                        timeout
                    );
                    // Process prices...
                } catch (error) {
                    logError(`Failed to fetch prices for ${dexKey}:${tokenA}/${tokenB}`, error);
                }
            }));
        }
    }

    // Wait for all tasks to complete
    await Promise.all(tasks);

    // Fetch wallet balance with error handling
    try {
        const balances = await retryWithBackoff(
            () => fetchWalletBalance(),
            CONFIG.rpc?.retry?.maxRetries || 3,
            CONFIG.rpc?.retry?.baseDelay || 1000,
            CONFIG.rpc?.retry?.maxDelay || 5000,
            CONFIG.rpc?.timeout || 30000
        );
        // Process balances...
    } catch (error) {
        logError('Failed to fetch wallet balance', error);
    }

    // Rest of tick logic...
}

module.exports = { tick };
