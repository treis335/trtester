// agent/roles/narrator.js
const { callDeepSeek } = require('../utils/deepseek');
const config = require('../config');
const memory = require('../memory');

async function narrate(event) {
  console.log('📣 Narrador a traduzir evento...');
  const prompt = `
És o Narrador da equipa. Traduzes eventos técnicos para linguagem humana simples e envolvente, em português.

EVENTO:
${JSON.stringify(event, null, 2)}

Responde com um JSON:
{
  "title": "título curto e apelativo",
  "body": "descrição detalhada do que aconteceu, o que significa e o que se segue, em português",
  "emoji": "emoji relevante"
}`;

  const response = await callDeepSeek(config.roles.narrator.systemPrompt, prompt);
  return response;
}

async function generateDailySummary() {
  const history = memory.get('history') || [];
  const narrativeLog = memory.get('narrativeLog') || [];

  const prompt = `
És o Narrador. Produz um resumo diário do estado do bot de arbitragem, com base no histórico recente.

HISTÓRICO DE CICLOS (últimas 24h):
${JSON.stringify(history.slice(-20))}

NARRATIVAS RECENTES:
${JSON.stringify(narrativeLog.slice(-10))}

Responde com um JSON:
{
  "title": "Resumo Diário do Bot",
  "body": "texto do resumo em português",
  "keyMetrics": {
    "cyclesCompleted": 0,
    "changesApproved": 0,
    "profitDetected": "0 SUPRA",
    "activeDEXs": []
  }
}`;

  const response = await callDeepSeek(config.roles.narrator.systemPrompt, prompt);
  return response;
}

module.exports = { narrate, generateDailySummary };