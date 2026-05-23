// agent/utils/deepseek.js
const axios = require('axios');
const config = require('../config');

async function callDeepSeek(systemPrompt, userMessage, temperature = 0.3) {
  const response = await axios.post(
    `${config.deepseekBaseUrl}/chat/completions`,
    {
      model: config.deepseekModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
      max_tokens: 4000,
    },
    {
      headers: {
        'Authorization': `Bearer ${config.deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  );
  return response.data.choices[0].message.content;
}

function extractJson(text) {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return null;
}

module.exports = { callDeepSeek, extractJson };