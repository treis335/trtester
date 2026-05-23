// agent/orchestrator.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { extractJson } = require('./utils/deepseek');
const { startBot, stopBot, isBotRunning } = require('./utils/botControl');
const config = require('./config');
const memory = require('./memory');
const { callDeepSeek } = require('./utils/deepseek');

const GUARDIAN_INTERVAL_MS = 30 * 1000;
const OPTIMIZER_INTERVAL_MS = 5 * 60 * 1000;
const EXPANSOR_INTERVAL_MS = 30 * 60 * 1000;

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'config.js');
const CONFIG_DEFAULT_PATH = path.join(__dirname, 'config_default.js');

// ─── Segurança do Config ──────────────────────────────────
function isConfigRequireable() {
  try {
    const mod = require(CONFIG_PATH);
    return mod && typeof mod.CONFIG === 'object' && mod.CONFIG.rpc;
  } catch (e) { return false; }
}

function getDefaultConfig() {
  if (!fs.existsSync(CONFIG_DEFAULT_PATH)) {
    console.log('⚠️ config_default.js não encontrado. A equipa irá gerar um novo.');
    return null;
  }
  return require(CONFIG_DEFAULT_PATH);
}

async function restoreConfig() {
  let defaultCfg = getDefaultConfig();
  if (!defaultCfg) {
    const prompt = `Gera um config.js funcional para bot de arbitragem Supra. Inclui rpc, dexes (Dexlyn), tokens (SUPRA, DEXUSDC, etc). Responde JSON: {"files": {"config/config.js": "conteúdo completo"}}`;
    const response = await callDeepSeek('És um developer Move.', prompt);
    const json = extractJson(response);
    if (json?.files && json.files['config/config.js']) {
      fs.writeFileSync(CONFIG_PATH, json.files['config/config.js'], 'utf8');
      console.log('🔄 Config gerado pela IA.');
      return;
    }
  }
  const defaultContent = `// config/config.js — restaurado automaticamente\nconst CONFIG = ${JSON.stringify(defaultCfg, null, 2)};\n\nmodule.exports = { CONFIG };`;
  fs.writeFileSync(CONFIG_PATH, defaultContent, 'utf8');
  console.log('🔄 Config restaurado a partir da cópia de segurança.');
}

function backupFiles(fileList) {
  if (!fs.existsSync(config.backupDir)) fs.mkdirSync(config.backupDir, { recursive: true });
  const ts = Date.now();
  for (const f of Object.keys(fileList)) {
    const src = path.join(__dirname, '..', f);
    if (fs.existsSync(src)) {
      const dest = path.join(config.backupDir, `${f.replace(/\//g, '_')}.${ts}.bak`);
      fs.copyFileSync(src, dest);
    }
  }
}

function restoreBackup(ts) {
  const files = fs.readdirSync(config.backupDir).filter(f => f.endsWith(`.${ts}.bak`));
  for (const f of files) {
    const orig = f.replace(`.${ts}.bak`, '').replace(/_/g, '/');
    fs.copyFileSync(path.join(config.backupDir, f), path.join(__dirname, '..', orig));
    console.log(`🔄 Restaurado: ${orig}`);
  }
}

// ─── Dashboard (inicia apenas se http-server estiver instalado) ────
let dashboardServer = null;
function startDashboard() {
  try {
    const dashboardDir = path.join(__dirname, '..', config.paths.dashboardDir);
    if (!fs.existsSync(dashboardDir)) fs.mkdirSync(dashboardDir, { recursive: true });
    const indexPath = path.join(dashboardDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, '<html><body><h1>Dashboard em construção</h1></body></html>');
    }
    // Tenta http-server global; se falhar, ignora silenciosamente
    dashboardServer = spawn('http-server', [dashboardDir, '-p', '3000', '--cors'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
    dashboardServer.on('error', () => {
      console.log('ℹ️ Dashboard não disponível (http-server não instalado). A equipa trabalha na mesma.');
      dashboardServer = null;
    });
  } catch (err) {
    console.log('ℹ️ Dashboard não disponível.');
  }
}
function stopDashboard() { if (dashboardServer) { dashboardServer.kill(); dashboardServer = null; } }

// ─── Telegram ─────────────────────────────────────────────
let telegramProcess = null;
function startTelegramBot() {
  try {
    const botPath = path.join(__dirname, '..', config.paths.telegramDir, 'bot.js');
    if (fs.existsSync(botPath) && config.telegramBotToken) {
      telegramProcess = spawn('node', [botPath], { cwd: path.join(__dirname, '..'), stdio: 'ignore', env: { ...process.env } });
    }
  } catch (err) {
    console.log('ℹ️ Bot Telegram não iniciado.');
  }
}
function stopTelegramBot() { if (telegramProcess) { telegramProcess.kill(); telegramProcess = null; } }

// ─── Guardião ──────────────────────────────────────────────
async function guardian() {
  if (!isConfigRequireable()) {
    console.log('🛡️ Guardião: config partido, a restaurar...');
    await restoreConfig();
    stopBot();
    await new Promise(r => setTimeout(r, 2000));
  }
  if (!isBotRunning()) {
    console.log('🛡️ Guardião: bot parado, a iniciar...');
    startBot();
    await new Promise(r => setTimeout(r, 8000));
    if (!isBotRunning()) {
      console.log('🛡️ Guardião: falha ao iniciar. A investigar...');
      const errors = fs.existsSync(config.paths.errorLog)
        ? fs.readFileSync(config.paths.errorLog, 'utf8').slice(-2000)
        : '';
      const prompt = `O bot não arranca. Últimos erros:\n${errors}\n\nGera uma correção JSON: {"files": {"config/config.js": "conteúdo completo"}}`;
      const response = await callDeepSeek('És um engenheiro DevOps. Corrige o bot.', prompt);
      const json = extractJson(response);
      if (json?.files) {
        backupFiles(json.files);
        const ts = Date.now();
        for (const [f, c] of Object.entries(json.files)) {
          fs.writeFileSync(path.join(__dirname, '..', f), c);
        }
        startBot();
        await new Promise(r => setTimeout(r, 8000));
        if (!isBotRunning()) {
          restoreBackup(ts);
          startBot();
        }
      }
    }
  }
}

// ─── Analista de Lucro ─────────────────────────────────────
async function profitAnalyst() {
  const metrics = fs.existsSync(config.paths.metrics)
    ? fs.readFileSync(config.paths.metrics, 'utf8')
    : '';
  const lastTrades = metrics.split('\n').filter(l => l.includes('success')).slice(-10);
  const hasProfit = lastTrades.length > 0;

  if (!hasProfit) {
    console.log('💰 Analista de Lucro: sem trades recentes. A forçar optimização...');
    const prompt = `
O bot não fez trades. Optimiza o config para começar a lucrar.
Config actual: ${fs.readFileSync(CONFIG_PATH, 'utf8').slice(0, 3000)}
Responde JSON: {"files": {"config/config.js": "conteúdo completo com minProfitPct=0.05 e minScore=15"}}`;
    const response = await callDeepSeek('És um analista de lucro. Optimiza o bot.', prompt);
    const json = extractJson(response);
    if (json?.files) {
      backupFiles(json.files);
      const ts = Date.now();
      for (const [f, c] of Object.entries(json.files)) {
        fs.writeFileSync(path.join(__dirname, '..', f), c);
      }
      stopBot();
      await new Promise(r => setTimeout(r, 2000));
      startBot();
      await new Promise(r => setTimeout(r, 10000));
      if (!isBotRunning()) { restoreBackup(ts); startBot(); }
    }
  } else {
    console.log(`💰 Analista de Lucro: ${lastTrades.length} trades recentes.`);
  }
}

// ─── Expansor ─────────────────────────────────────────────
async function expansor() {
  console.log('🌐 Expansor: a procurar novas DEXs...');
  const dexesPath = path.join(__dirname, '..', config.paths.dexesDir);
  if (!fs.existsSync(dexesPath)) return;
  const availableDEXs = fs.readdirSync(dexesPath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name.toUpperCase());

  const configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
  const integratedDEXs = (configContent.match(/['"]?[A-Z]+['"]?\s*:\s*\{/g) || []).map(m => m.replace(/['":\s{]/g, ''));

  const missingDEXs = availableDEXs.filter(d => !integratedDEXs.includes(d));

  if (missingDEXs.length > 0) {
    console.log(`🌐 Expansor: DEXs não integradas: ${missingDEXs.join(', ')}. A integrar...`);
    const prompt = `
Integra as DEXs ${missingDEXs.join(', ')} no config.
Config actual: ${configContent.slice(0, 3000)}
Responde JSON: {"files": {"config/config.js": "conteúdo completo com novas DEXs"}}`;
    const response = await callDeepSeek('És um integrador de DEXs.', prompt);
    const json = extractJson(response);
    if (json?.files) {
      backupFiles(json.files);
      const ts = Date.now();
      for (const [f, c] of Object.entries(json.files)) {
        fs.writeFileSync(path.join(__dirname, '..', f), c);
      }
      stopBot();
      await new Promise(r => setTimeout(r, 2000));
      startBot();
      await new Promise(r => setTimeout(r, 10000));
      if (!isBotRunning()) { restoreBackup(ts); startBot(); }
    }
  } else {
    console.log('🌐 Expansor: todas as DEXs já integradas.');
  }
}

// ─── Orquestrador principal ──────────────────────────────
async function main() {
  console.log('🚀 Equipa de Lucro Autónoma iniciada.');
  memory.load();
  startDashboard();
  startTelegramBot();

  await guardian();

  setInterval(guardian, GUARDIAN_INTERVAL_MS);
  setInterval(profitAnalyst, OPTIMIZER_INTERVAL_MS);
  setInterval(expansor, EXPANSOR_INTERVAL_MS);

  while (true) {
    await new Promise(r => setTimeout(r, 60000));
    console.log('⏱️ Equipa ativa...');
  }
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  setTimeout(main, 60000);
});