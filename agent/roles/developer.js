// agent/roles/developer.js
const fs = require('fs');
const { callDeepSeek } = require('../utils/deepseek');
const config = require('../config');

async function develop(analysisJson, qaFeedback = null) {
  console.log('💻 Developer a trabalhar...');
  const currentConfig = fs.existsSync(config.paths.config)
    ? fs.readFileSync(config.paths.config, 'utf8')
    : 'ficheiro não encontrado';
  const currentTick = fs.existsSync(config.paths.tickJs)
    ? fs.readFileSync(config.paths.tickJs, 'utf8')
    : 'ficheiro não encontrado';

  let feedbackText = qaFeedback ? `\nQA rejeitou a versão anterior: ${qaFeedback}\nCorrige TODOS os problemas.\n` : '';

  const prompt = `
Análise: ${analysisJson}
${feedbackText}
Ficheiros atuais:
CONFIG: ${currentConfig.slice(0, 4000)}
TICK: ${currentTick.slice(0, 4000)}

Gera alterações. Responde APENAS com JSON:
{
  "files": {
    "config/config.js": "conteúdo completo",
    "loop/tick.js": "conteúdo completo"
  },
  "commitMessage": "descrição"
}`;

  const response = await callDeepSeek(config.roles.developer.systemPrompt, prompt);
  return response;
}

module.exports = { develop };