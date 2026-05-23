// agent/roles/planner.js
const { callDeepSeek } = require('../utils/deepseek');
const config = require('../config');
const memory = require('../memory');

async function plan(analysisJson, currentConfigContent, emergency = null) {
  console.log('🎯 Planeador a definir estratégia...');
  const history = memory.get('history') || [];
  const hasTelegram = !!config.telegramBotToken;

  let emergencyContext = '';
  if (emergency) {
    emergencyContext = `
⚠️ EMERGÊNCIA DETETADA:
${emergency.summary}
Ações sugeridas pelo Diagnosticador: ${emergency.actions.join(', ')}
`;
  }

  const prompt = `
És o Planeador. ${emergency ? 'Estamos em modo de emergência. A prioridade máxima é corrigir o problema crítico.' : 'Define o plano de expansão e melhoria.'}

ANÁLISE: ${JSON.stringify(analysisJson)}
HISTÓRICO: ${JSON.stringify(history.slice(-5))}
CONFIG ACTUAL: ${currentConfigContent.slice(0, 2000)}
TELEGRAM DISPONÍVEL: ${hasTelegram ? 'Sim' : 'Não'}
${emergencyContext}

Responde APENAS com JSON:
{
  "goals": ["meta 1", "meta 2"],
  "priority": "alta/média/baixa",
  "instructions": "instruções detalhadas para o Developer"
}`;

  const response = await callDeepSeek(config.roles.planner.systemPrompt, prompt);
  return response;
}

module.exports = { plan };