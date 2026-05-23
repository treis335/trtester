// agent/roles/analyst.js
const fs = require('fs');
const { callDeepSeek } = require('../utils/deepseek');
const config = require('../config');

async function analyse() {
  console.log('🧠 Analista a examinar dados...');
  const metrics = fs.existsSync(config.paths.metrics)
    ? fs.readFileSync(config.paths.metrics, 'utf8').slice(-5000)
    : 'sem métricas';
  const errors = fs.existsSync(config.paths.errorLog)
    ? fs.readFileSync(config.paths.errorLog, 'utf8').slice(-2000)
    : 'sem erros';

  const prompt = `
Analisa os dados do bot de arbitragem:

MÉTRICAS (últimas linhas):
${metrics || 'nenhuma'}

ERROS (últimas linhas):
${errors || 'nenhum'}

Responde APENAS com JSON:
{
  "pairsToKeep": ["SUPRA/DEXUSDC"],
  "pairsToRemove": [],
  "parameterSuggestions": { "minProfitPct": 0.15 },
  "issuesFound": [],
  "summary": "resumo em português"
}`;

  const response = await callDeepSeek(config.roles.analyst.systemPrompt, prompt);
  return response;
}

module.exports = { analyse };