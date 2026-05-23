// agent/roles/diagnosticator.js
const fs = require('fs');
const { callDeepSeek } = require('../utils/deepseek');
const config = require('../config');

const REQUIRED_CONFIG_PROPS = [
  'rpc', 'pollingMs', 'minProfitPct', 'viewTimeout', 'viewRetries',
  'maxConcurrent', 'autoExecute', 'dexes', 'tokens',
  'RESERVES_CACHE_TTL', 'SLIPPAGE_DYNAMIC', 'MIN_VOLUME_24H',
  'MIN_SPREAD', 'MAX_HOPS', 'PROFIT_GAS_RATIO_MIN'
];

function checkConfigIntegrity(configContent) {
  const missing = [];
  for (const prop of REQUIRED_CONFIG_PROPS) {
    if (!configContent.includes(`${prop}`)) {
      missing.push(prop);
    }
  }
  return missing;
}

async function diagnose() {
  console.log('🔍 Diagnosticador a verificar saúde do bot...');
  const errors = fs.existsSync(config.paths.errorLog)
    ? fs.readFileSync(config.paths.errorLog, 'utf8').slice(-5000)
    : 'sem erros';
  const metrics = fs.existsSync(config.paths.metrics)
    ? fs.readFileSync(config.paths.metrics, 'utf8').slice(-2000)
    : 'sem métricas';
  const configContent = fs.existsSync(config.paths.config)
    ? fs.readFileSync(config.paths.config, 'utf8')
    : '';

  // Verificação de integridade do config (rápida, sem IA)
  const missingProps = checkConfigIntegrity(configContent);
  if (missingProps.length > 0) {
    return {
      critical: true,
      summary: `Config incompleto — propriedades em falta: ${missingProps.join(', ')}.`,
      actions: [`Adicionar propriedades em falta: ${missingProps.join(', ')}`],
      missingProps,
    };
  }

  // Análise profunda com IA (apenas se necessário)
  const prompt = `
Analisa os logs de erro e métricas do bot de arbitragem. Determina se há problemas críticos que impeçam o funcionamento.

ERROS (últimas 5000 chars):
${errors}

MÉTRICAS (últimas 2000 chars):
${metrics}

Responde APENAS com JSON:
{
  "critical": true/false,
  "summary": "descrição do problema",
  "actions": ["acção 1", "acção 2"]
}`;

  let response;
  try {
    response = await callDeepSeek('És um diagnosticador de sistemas.', prompt);
  } catch (e) {
    console.error('❌ Diagnosticador: erro na API:', e.message);
    return { critical: false, summary: 'Erro ao contactar a API de diagnóstico.' };
  }

  // Garantir que a resposta é uma string antes de tentar extrair JSON
  if (typeof response !== 'string') {
    console.error('❌ Diagnosticador: resposta inesperada da API (não é string).');
    return { critical: false, summary: 'Resposta inválida da API de diagnóstico.' };
  }

  return response;
}

module.exports = { diagnose };