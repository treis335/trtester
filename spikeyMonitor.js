// spikeyMonitor.js — Monitor TUI das pools da Spikey (lê do spikeyPools.json)
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const blessed = require('blessed');

const RPC = 'https://rpc-mainnet.supra.com/rpc/v1';
const SPIKEY = '0x3045d27b5fada1e30897a741fb184e48ef0bff3717aea23918ebc1e5c7153083';
const POOLS_FILE = './spikeyPools.json';
const POLLING_MS = 3000;

const DECIMALS = { SUPRA: 1e8, CASH: 1e8 };
function getDecimals(symbol) { return DECIMALS[symbol] || 1e6; }

async function callView(fn, args = []) {
    const res = await axios.post(`${RPC}/view`, {
        function: `${SPIKEY}::${fn}`,
        type_arguments: [],
        arguments: args,
    }, { timeout: 10000 });
    return res.data.result;
}

function getAmountOut(reserveIn, reserveOut, amountIn, feeBps = 25) {
    const rIn = BigInt(Math.floor(reserveIn));
    const rOut = BigInt(Math.floor(reserveOut));
    const aIn = BigInt(Math.floor(amountIn));
    const feeMul = 10000n - BigInt(feeBps);
    const afterFee = (aIn * feeMul) / 10000n;
    if (afterFee <= 0n) return 0n;
    return (afterFee * rOut) / (rIn + afterFee);
}

const lastPrices = {};

function loadPools() {
    try {
        return JSON.parse(fs.readFileSync(POOLS_FILE, 'utf8'));
    } catch (e) {
        return [{ address: '0xedefe502cabe49527b9fdb78baf36db44e476ae055bbe83b9121594f79a5bd22', tokenA: 'SUPRA', tokenB: 'DEXUSDC' }];
    }
}

async function fetchAllPools() {
    const pools = loadPools();
    const results = [];
    for (const pool of pools) {
        try {
            const [t0, t1, reserves, fee] = await Promise.all([
                callView('amm_pair::token0', [pool.address]),
                callView('amm_pair::token1', [pool.address]),
                callView('amm_pair::get_reserves', [pool.address]),
                callView('amm_controller::get_swap_fee').catch(() => [25]),
            ]);

            const tok0 = { symbol: pool.tokenA, decimals: getDecimals(pool.tokenA) };
            const tok1 = { symbol: pool.tokenB, decimals: getDecimals(pool.tokenB) };

            const reserve0 = Number(reserves[0]);
            const reserve1 = Number(reserves[1]);
            if (reserve0 === 0 && reserve1 === 0) continue;

            const feeBps = Number(Array.isArray(fee) ? fee[0] : fee);
            const price = Number(getAmountOut(reserve0, reserve1, tok0.decimals, feeBps)) / tok1.decimals;

            const key = pool.address;
            let change = null;
            if (lastPrices[key] !== undefined) {
                change = ((price - lastPrices[key]) / lastPrices[key]) * 100;
            }
            lastPrices[key] = price;

            results.push({ ...pool, token0: tok0.symbol, token1: tok1.symbol, reserve0, reserve1, feeBps, price, change });
        } catch (e) {}
    }
    return results;
}

// ═══ TUI ═══
const screen = blessed.screen({
    smartCSR: true, title: 'Spikey Monitor', fullUnicode: true, forceUnicode: true,
});
screen.program.hideCursor();

const headerBox = blessed.box({
    top: 0, left: 0, width: '100%', height: 3, tags: true, wrap: false,
    content: '{bold}{cyan-fg}  🦈 SPIKEY MONITOR{/}{/}\n{grey-fg}  Pools carregadas de spikeyPools.json{/}',
});

const tableBox = blessed.box({
    top: 3, left: 0, width: '100%', bottom: 1, tags: true, wrap: false,
    scrollable: true, alwaysScroll: true,
    scrollbar: { ch: '│', style: { fg: 'cyan' } },
    border: { type: 'line' },
    label: ' {bold}{cyan-fg}POOLS DA SPIKEY{/}{/} ',
    style: { border: { fg: 'cyan' } },
});

const footerBox = blessed.box({
    bottom: 0, left: 0, width: '100%', height: 1, tags: true, wrap: false,
    content: '{grey-fg} q: sair | Atualiza a cada 3s | Adiciona pools em spikeyPools.json{/}',
});

screen.append(headerBox);
screen.append(tableBox);
screen.append(footerBox);

screen.key(['q', 'C-c'], () => {
    screen.program.showCursor();
    screen.destroy();
    process.exit(0);
});

function formatChange(pct) {
    if (pct === null) return '{grey-fg}     ─     {/}';
    const sign = pct >= 0 ? '+' : '';
    const color = pct >= 0.01 ? 'green' : pct <= -0.01 ? 'red' : 'grey';
    return `{${color}-fg}${sign}${pct.toFixed(3)}%{/}`;
}

async function tick() {
    const data = await fetchAllPools();
    const lines = [];
    lines.push('{grey-fg}  PAR                PREÇO               Δ%           RES.A             RES.B             FEE{/}');
    lines.push('{grey-fg}  ' + '─'.repeat(82) + '{/}');

    for (const p of data) {
        const pair = `{bold}${p.token0}{/}/{grey-fg}${p.token1}{/}`.padEnd(16);
        const price = p.price.toFixed(6).padStart(14);
        const change = formatChange(p.change).padStart(12);
        const resA = (p.reserve0 / getDecimals(p.token0)).toFixed(2).padStart(14);
        const resB = (p.reserve1 / getDecimals(p.token1)).toFixed(2).padStart(14);
        const fee = ((p.feeBps / 100).toFixed(2) + '%').padStart(6);
        lines.push(`  ${pair}${price}  ${change}${resA}  ${resB}${fee}`);
    }

    if (data.length === 0) {
        lines.push('{yellow-fg}  Nenhuma pool com liquidez.{/}');
    }

    tableBox.setContent(lines.join('\n'));
    screen.render();
}

(async () => {
    await tick();
    setInterval(tick, POLLING_MS);
})();