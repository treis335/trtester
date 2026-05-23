// agent/config.js
require('dotenv').config();

module.exports = {
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  deepseekModel: 'deepseek-chat',
  deepseekBaseUrl: 'https://api.deepseek.com/v1',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || null,
  telegramChatId: process.env.TELEGRAM_CHAT_ID || null,

  roles: {
    planner: {
      name: 'Planeador',
      systemPrompt: `És o coordenador estratégico... (manter igual)`,
    },
    analyst: {
      name: 'Analista',
      systemPrompt: `Analisas logs e métricas... (manter igual)`,
    },
    developer: {
      name: 'Developer',
      systemPrompt: `És um programador fullstack... (manter igual)`,
    },
    qa: {
      name: 'QA',
      systemPrompt: `Revês alterações... (manter igual)`,
    },
    narrator: {
      name: 'Narrador',
      systemPrompt: `És o comunicador da equipa. O teu trabalho é traduzir todas as acções técnicas, decisões e resultados para uma linguagem humana, clara e envolvente, em português.
Produzes títulos, resumos e descrições que podem ser mostrados num dashboard ou enviados por Telegram.
És o "rosto" da equipa para o utilizador.`,
    },
  },

  paths: {
    config: 'config/config.js',
    metrics: 'metrics.csv',
    errorLog: 'arb_errors.log',
    tickJs: 'loop/tick.js',
    dexesDir: 'dexes',
    dashboardDir: 'dashboard',
    telegramDir: 'telegram',
  },

  memoryFile: 'agent/memory.json',
  backupDir: 'agent/backups',
  cycleIntervalMs: 10 * 60 * 1000,
};