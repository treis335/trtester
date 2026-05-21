const { SupraClient, HexString, SupraAccount, BCS, TxnBuilderTypes } = require('supra-l1-sdk');
const { CONFIG } = require('../../config/config');
const { logError } = require('../../utils/logError');

async function executeAtmosSwap(opportunity, onLog = () => {}) {
    const origLog = console.log;
    try {
        console.log = () => {};
        const client = await SupraClient.init('https://rpc-mainnet.supra.com');
        const pkHex = process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : '0x' + process.env.PRIVATE_KEY;
        const account = new SupraAccount(HexString.ensure(pkHex).toUint8Array());

        const { cycle, result, optimalAmount } = opportunity;
        const { steps } = result;

        const tokenIn = CONFIG.tokens[cycle.path[0]];
        const tokenOut = CONFIG.tokens[cycle.path[cycle.path.length - 1]];

        const amountIn = BigInt(Math.floor(optimalAmount * tokenIn.decimals));
        const minOut = BigInt(Math.floor(steps[steps.length - 1].amtOut * tokenOut.decimals * 0.995));

        // Construir o array de endereços das pools no caminho
        const route = steps.map(s => s.pair.pairAddress);

        onLog('{grey-fg}A obter sequence number...{/}');
        const accInfo = await client.getAccountInfo(new HexString(process.env.SENDER_ADDRESS));
        const seq = BigInt(accInfo.sequence_number);

        onLog('{grey-fg}A construir transação Atmos...{/}');
        const funcArgs = [
            BCS.bcsSerializeUint64(amountIn),
            BCS.bcsSerializeUint64(minOut),
            route,
            process.env.SENDER_ADDRESS,
            Math.floor(Date.now() / 1000) + 300,
        ];
        const funcTypeArgs = [
            new TxnBuilderTypes.TypeTagParser(tokenIn.type).parseTypeTag(),
            new TxnBuilderTypes.TypeTagParser(tokenOut.type).parseTypeTag(),
        ];

        const rawTx = await client.createRawTxObject(
            new HexString(process.env.SENDER_ADDRESS), BigInt(seq),
            '0xa4a4a31116e114bf3c4f4728914e6b43db73279a4421b0768993e07248fe2234', 'liquidity_pool',
            'swap', // função pública que aceita os argumentos corretos? Vamos usar a entry do aggregator por segurança
            funcTypeArgs, funcArgs,
            { maxGasAmount: BigInt(5000), gasUnitPrice: BigInt(100000), expirationTime: Math.floor(Date.now() / 1000) + 300 }
        );

        const ser = new BCS.Serializer();
        rawTx.serialize(ser);
        const serTx = ser.getBytes();

        onLog('{yellow-fg}A submeter transação Atmos...{/}');
        const txRes = await client.sendTxUsingSerializedRawTransaction(account, serTx, {
            enableWaitForTransaction: true,
            enableTransactionSimulation: true,
        });
        onLog('{green-fg}✅ Transação submetida!{/}');
        return { txHash: txRes.txHash, success: true };
    } catch (e) {
        logError('executeAtmosSwap', e);
        onLog(`{red-fg}❌ Erro: ${e.message}{/}`);
        return null;
    } finally { console.log = origLog; }
}

module.exports = { executeAtmosSwap };