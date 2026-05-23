// agent/roles/investigator.js
const { callDeepSeek } = require('../utils/deepseek');
const config = require('../config');

async function investigate(errorSummary, currentConfigContent) {
  console.log('🕵️ Investigador a analisar causa raiz...');
  const prompt = `
És um investigador de software. Com base no erro reportado e no estado actual do código, determina a causa raiz e sugere uma correção precisa.

ERRO: ${errorSummary}

CONFIG ACTUAL:
${currentConfigContent.slice(0, 3000)}

Responde APENAS com JSON:
{
  "rootCause": "descrição da causa raiz",
  "fix": {
    "files": {
      "config/config.js": "novo conteúdo completo corrigido",
      "loop/tick.js": "novo conteúdo se necessário"
    },
    "commitMessage": "descrição da correção"
  }
}`;

  const response = await callDeepSeek('És um investigador de software.', prompt);
  return response;
}

module.exports = { investigate };