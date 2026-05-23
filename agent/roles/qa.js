// agent/roles/qa.js
const { callDeepSeek } = require('../utils/deepseek');
const config = require('../config');

async function review(generatedJson) {
  console.log('🔍 QA a rever...');

  // Validação pré‑IA: o config NÃO pode perder a secção de tokens
  if (generatedJson.files && generatedJson.files['config/config.js']) {
    const newConfig = generatedJson.files['config/config.js'];
    if (!newConfig.includes('tokens:') || !newConfig.includes('SUPRA:')) {
      console.log('❌ QA bloqueou: config sem tokens.');
      return JSON.stringify({
        approved: false,
        issues: ['config/config.js não contém a secção tokens ou o token SUPRA.'],
        recommendation: 'rejeitar',
      });
    }
  }

  const prompt = `
Revê as alterações propostas.
REGRAS ABSOLUTAS:
- O ficheiro config/config.js DEVE conter a secção "tokens" com pelo menos os tokens SUPRA, DEXUSDC, LUCKY, DAWGZ.
- Nenhum token existente pode ser removido.
- Novos parâmetros devem ter valores razoáveis.

Alterações:
${JSON.stringify(generatedJson, null, 2)}

Responde APENAS com JSON:
{
  "approved": true,
  "issues": [],
  "recommendation": "aprovar"
}`;

  const response = await callDeepSeek(config.roles.qa.systemPrompt, prompt);
  return response;
}

module.exports = { review };