// agent/roles/qa.js
const { callDeepSeek } = require('../utils/deepseek');
const config = require('../config');

async function review(generatedJson) {
  console.log('🔍 QA a rever...');
  const prompt = `
Revê as alterações:
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