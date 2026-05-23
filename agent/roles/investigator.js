// agent/roles/investigator.js
const { callDeepSeek } = require('../utils/deepseek');
const config = require('../config');

async function investigate(errorSummary, currentConfigContent) {
  console.log('🕵️ Investigador a analisar causa raiz...');
  const prompt = `
És um investigador de software. Determina a causa raiz e gera uma correção precisa.

ERRO: ${errorSummary}

CONFIG ACTUAL:
${currentConfigContent.slice(0, 3000)}

Se o erro for "Config incompleto" com propriedades em falta, adiciona-as ao config com valores padrão seguros.
Exemplo: RESERVES_CACHE_TTL: 2000, SLIPPAGE_DYNAMIC: true, etc.

Responde APENAS com JSON:
{
  "rootCause": "descrição",
  "fix": {
    "files": {
      "config/config.js": "novo conteúdo completo corrigido"
    },
    "commitMessage": "descrição"
  }
}`;

  const response = await callDeepSeek('És um investigador de software.', prompt);
  return response;
}

module.exports = { investigate };