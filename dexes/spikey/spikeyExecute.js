const { SupraClient, HexString, SupraAccount, BCS, TxnBuilderTypes } = require('supra-l1-sdk');
const { CONFIG } = require('../../config/config');
const { logError } = require('../../utils/logError');
const { SPIKEY_CONFIG } = require('./spikeyConfig');

async function executeSpikeySwap(opportunity, onLog = () => {}) {
    const originalLog = console.log;
    try {
        console.log = () => {};

        const client = await SupraClient.init('https://rpc-mainnet.supra.com');
        const privateKeyHex = process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : '0x' + process.env.PRIVATE_KEY;
        const account = new SupraAccount(HexString.ensure(privateKeyHex).toUint8Array());

        const { cycle, result, optimalAmount } = opportunity;
        const { steps } = result;

        // Extrai a rota de pares (endereços das pools)
        const route = steps.map(s => s.pair.pairAddress || s.pair.address);
        const tokenIn = CONFIG.tokens[cycle.path[0]];
        const tokenOut = CONFIG.tokens[cycle.path[cycle.path.length - 1]];

        const amountIn = BigInt(Math.floor(optimalAmount * tokenIn.decimals));
        // minOut é o lucro esperado (último step) com slippage
        const minOut = BigInt(Math.floor(steps[steps.length - 1].amtOut * tokenOut.decimals * 0.995));

        onLog('{grey-fg}A obter sequence number...{/}');
        const accountInfo = await client.getAccountInfo(new HexString(process.env.SENDER_ADDRESS));
        const sequenceNumber = BigInt(accountInfo.sequence_number);

        onLog('{grey-fg}A construir transação Spikey...{/}');

        // Constrói a entry function: amm_router::swap_exact_coins_for_coins_beta
        const functionArgs = [
            BCS.bcsSerializeUint64(amountIn),
            BCS.bcsSerializeUint64(minOut),
            route.map(addr => addr.startsWith('0x') ? addr.slice(2) : addr), // array de endereços
            process.env.SENDER_ADDRESS.startsWith('0x') ? process.env.SENDER_ADDRESS : '0x' + process.env.SENDER_ADDRESS,
            Math.floor(Date.now() / 1000) + 300 // deadline
        ];

        const functionTypeArgs = [
            new TxnBuilderTypes.TypeTagParser(tokenIn.type).parseTypeTag(),
            new TxnBuilderTypes.TypeTagParser(tokenOut.type).parseTypeTag(),
        ];

        const rawTx = await client.createRawTxObject(
            new HexString(process.env.SENDER_ADDRESS),
            BigInt(sequenceNumber),
            SPIKEY_CONFIG.routerAddress,
            SPIKEY_CONFIG.moduleName,
            'swap_exact_coins_for_coins_beta',
            functionTypeArgs,
            functionArgs,
            {
                maxGasAmount: BigInt(5000),
                gasUnitPrice: BigInt(100000),
                expirationTime: Math.floor(Date.now() / 1000) + 300
            }
        );

        const serializer = new BCS.Serializer();
        rawTx.serialize(serializer);
        const serializedRawTx = serializer.getBytes();

        onLog('{yellow-fg}A submeter transação na Spikey...{/}');
        const txResult = await client.sendTxUsingSerializedRawTransaction(
            account,
            serializedRawTx,
            { enableWaitForTransaction: true, enableTransactionSimulation: true }
        );

        onLog('{green-fg}✅ Transação submetida!{/}');
        return { txHash: txResult.txHash, success: true };
    } catch (err) {
        logError('executeSpikeySwap', err);
        onLog(`{red-fg}❌ Erro: ${err.message}{/}`);
        return null;
    } finally {
        console.log = originalLog;
    }
}

module.exports = { executeSpikeySwap };