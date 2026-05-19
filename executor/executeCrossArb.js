const fs = require('fs');
const path = require('path');
const { SupraClient, HexString, SupraAccount, BCS, TxnBuilderTypes } = require('supra-l1-sdk');
const { CONFIG } = require('../config/config');
const { logError } = require('../utils/logError');

const scriptBytecode = (() => {
    try { return fs.readFileSync(path.join(__dirname, '..', 'move', 'crossdex_arbitrage.mv')); }
    catch (e) { console.error('Script cross‑DEX não encontrado.'); return null; }
})();

async function executeCrossArbitrage(opportunity, onLog = () => {}) {
    if (!scriptBytecode) {
        onLog('{red-fg}Script cross‑DEX não compilado. Coloca crossdex_arbitrage.mv em src/move/.{/}');
        return null;
    }
    const origLog = console.log;
    try {
        console.log = () => {};
        const client = await SupraClient.init('https://rpc-mainnet.supra.com');
        const pkHex = process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : '0x' + process.env.PRIVATE_KEY;
        const account = new SupraAccount(HexString.ensure(pkHex).toUint8Array());

        const { cycle, result, optimalAmount } = opportunity;
        const { steps } = result;

        const tokenA = CONFIG.tokens[cycle.path[0]];
        const tokenB = CONFIG.tokens[cycle.path[1]];
        const tokenC = CONFIG.tokens[cycle.path[2]];
        const dex = CONFIG.dexes.DEXLYN;

        const curveAB = steps[0].pair.curve === 'constant_product' ? 'curves::Uncorrelated' : dex.curveTypes[steps[0].pair.curve];
        const curveBC = steps[1].pair.curve === 'constant_product' ? 'curves::Uncorrelated' : dex.curveTypes[steps[1].pair.curve];
        const curveCA = steps[2].pair.curve === 'constant_product' ? 'curves::Uncorrelated' : dex.curveTypes[steps[2].pair.curve];

        const typeArgs = [
            tokenA.type, tokenB.type, tokenC.type,
            `${dex.moduleAddress}::${curveAB}`,
            `${dex.moduleAddress}::${curveBC}`,
            `${dex.moduleAddress}::${curveCA}`,
        ];

        const amountIn = BigInt(Math.floor(optimalAmount * tokenA.decimals));

        function getSlippage(reserveOut, decimalsOut) {
            const liq = reserveOut / decimalsOut;
            if (liq < 100) return 0.97; else if (liq < 1000) return 0.98;
            else if (liq < 10000) return 0.99; else return 0.995;
        }

        const slipAB = getSlippage(steps[0].pair.reserveB, CONFIG.tokens[steps[0].to]?.decimals || 1e6);
        const slipBC = getSlippage(steps[1].pair.reserveB, CONFIG.tokens[steps[1].to]?.decimals || 1e6);
        const slipCA = getSlippage(steps[2].pair.reserveB, CONFIG.tokens[steps[2].to]?.decimals || 1e6);

        const minOutAB = BigInt(Math.floor(steps[0].amtOut * CONFIG.tokens[steps[0].to].decimals * slipAB));
        const minOutBC = BigInt(Math.floor(steps[1].amtOut * CONFIG.tokens[steps[1].to].decimals * slipBC));
        const minOutCA = BigInt(Math.floor(steps[2].amtOut * CONFIG.tokens[steps[2].to].decimals * slipCA));

        onLog('{grey-fg}A obter sequence number...{/}');
        const accInfo = await client.getAccountInfo(new HexString(process.env.SENDER_ADDRESS));
        const seq = BigInt(accInfo.sequence_number);

        onLog('{grey-fg}A construir script cross‑DEX...{/}');
        const script = new TxnBuilderTypes.Script(
            new Uint8Array(scriptBytecode),
            typeArgs.map(ta => new TxnBuilderTypes.TypeTagParser(ta).parseTypeTag()),
            [
                new TxnBuilderTypes.TransactionArgumentU64(amountIn),
                new TxnBuilderTypes.TransactionArgumentU64(minOutAB),
                new TxnBuilderTypes.TransactionArgumentU64(minOutBC),
                new TxnBuilderTypes.TransactionArgumentU64(minOutCA),
            ]
        );

        const payload = new TxnBuilderTypes.TransactionPayloadScript(script);
        const rawTx = new TxnBuilderTypes.RawTransaction(
            new TxnBuilderTypes.AccountAddress(HexString.ensure(process.env.SENDER_ADDRESS).toUint8Array()),
            seq, payload, 5000n, 100000n,
            BigInt(Math.floor(Date.now() / 1000) + 300),
            new TxnBuilderTypes.ChainId(8)
        );

        const ser = new BCS.Serializer();
        rawTx.serialize(ser);
        const serTx = ser.getBytes();

        // Simular antes de enviar
        onLog('{grey-fg}A simular transação cross‑DEX...{/}');
        try {
            const simResult = await client.simulateTransaction(serTx, account);
            if (!simResult?.success) {
                onLog(`{yellow-fg}⚠️ Simulação falhou: ${simResult?.vm_status || 'desconhecido'}. Transação abortada.{/}`);
                return null;
            }
        } catch (_) { /* SDK pode não ter simulateTransaction — prossegue */ }

        onLog('{yellow-fg}A submeter transação cross‑DEX...{/}');
        const txRes = await client.sendTxUsingSerializedRawTransaction(account, serTx, {
            enableWaitForTransaction: true,
            enableTransactionSimulation: true,
        });
        onLog('{green-fg}✅ Transação cross‑DEX submetida!{/}');
        return { txHash: txRes.txHash, success: true };
    } catch (e) {
        logError('executeCrossArbitrage', e);
        onLog(`{red-fg}❌ Erro: ${e.message}{/}`);
        return null;
    } finally { console.log = origLog; }
}

module.exports = { executeCrossArbitrage };