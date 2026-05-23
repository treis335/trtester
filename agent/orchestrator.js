// agent/orchestrator.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { extractJson } = require('./utils/deepseek');
const { startBot, stopBot, isBotRunning } = require('./utils/botControl');
const config = require('./config');
const memory = require('./memory');
const { callDeepSeek } = require('./utils/deepseek');

const CYCLE_INTERVAL_MS = config.cycleIntervalMs;
const GUARDIAN_INTERVAL_MS = 30 * 1000; // 30 segundos
const OPTIMIZER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const EXPANSOR_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'config.js');
const CONFIG_DEFAULT = require('./config_default.js');

// ─── Segurança do Config ──────────────────────────────────
function isConfigRequireable() {
  try {
    const mod = require(CONFIG_PATH);
    return mod && typeof mod.CONFIG === 'object' && mod.CONFIG.rpc;
  } catch (e) { return false; }
}

function restoreConfig() {
  const defaultContent = `// config/config.js — restaurado automaticamente\nconst CONFIG = ${JSON.stringify(CONFIG_DEFAULT, null, 2)};\n\nmodule.exports = { CONFIG };`;
  fs.writeFileSync(CONFIG_PATH, defaultContent, 'utf8');
  console.log('🔄 Config restaurado.');
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

function addNarrative(entry) {
  const log = memory.get('narrativeLog') || [];
  log.push({ timestamp: new Date().toISOString(), ...entry });
  memory.set('narrativeLog', log.slice(-50));
  fs.appendFileSync('narratives.jsonl', JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n');
}

// ─── Servidores auxiliares ────────────────────────────────
let dashboardServer = null;
function startDashboard() {
  const dashboardPath = path.join(__dirname, '..', config.paths.dashboardDir, 'index.html');
  if (fs.existsSync(dashboardPath)) {
    dashboardServer = spawn('npx', ['http-server', config.paths.dashboardDir, '-p', '3000', '--cors'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  }
}
function stopDashboard() { if (dashboardServer) { dashboardServer.kill(); dashboardServer = null; } }

let telegramProcess = null;
function startTelegramBot() {
  const botPath = path.join(__dirname, '..', config.paths.telegramDir, 'bot.js');
  if (fs.existsSync(botPath) && config.telegramBotToken) {
    telegramProcess = spawn('node', [botPath], { cwd: path.join(__dirname, '..'), stdio: 'ignore', env: { ...process.env } });
  }
}
function stopTelegramBot() { if (telegramProcess) { telegramProcess.kill(); telegramProcess = null; } }

// ─── Agentes especializados ──────────────────────────────

// 1. GUARDIÃO – mantém o bot vivo
async function guardian() {
  if (!isConfigRequireable()) {
    console.log('🛡️ Guardião: config partido, a restaurar...');
    restoreConfig();
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

// 2. ANALISTA DE LUCRO – verifica se houve trades lucrativas
async function profitAnalyst() {
  const metrics = fs.existsSync(config.paths.metrics)
    ? fs.readFileSync(config.paths.metrics, 'utf8')
    : '';
  const lastTrades = metrics.split('\n').filter(l => l.includes('success')).slice(-10);
  const hasProfit = lastTrades.length > 0;

  if (!hasProfit) {
    console.log('💰 Analista de Lucro: sem trades recentes. A forçar optimização...');
    const prompt = `
O bot de arbitragem não fez trades nas últimas horas.
Métricas: ${metrics.slice(-2000)}
Config actual: ${fs.readFileSync(CONFIG_PATH, 'utf8').slice(0, 3000)}

Responde com JSON:
{
  "files": {
    "config/config.js": "conteúdo completo com minProfitPct reduzido para 0.05 e slippage ajustado para capturar mais oportunidades"
  },
  "commitMessage": "optimização de lucro"
}`;
    const response = await callDeepSeek('És um analista de lucro. Optimiza o bot para começar a lucrar.', prompt);
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

// 3. EXPANSOR – adiciona novas DEXs e pares
async function expansor() {
  console.log('🌐 Expansor: a procurar novas DEXs e pares...');
  const availableDEXs = fs.readdirSync(path.join(__dirname, '..', config.paths.dexesDir), { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name.toUpperCase());

  const configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
  const integratedDEXs = (configContent.match(/['"]?[A-Z]+['"]?\s*:\s*\{/g) || []).map(m => m.replace(/['":\s{]/g, ''));

  const missingDEXs = availableDEXs.filter(d => !integratedDEXs.includes(d));

  if (missingDEXs.length > 0) {
    console.log(`🌐 Expansor: DEXs não integradas: ${missingDEXs.join(', ')}. A integrar...`);
    const prompt = `
Integra as DEXs ${missingDEXs.join(', ')} no config do bot.
Config actual: ${configContent.slice(0, 3000)}

Responde com JSON: {"files": {"config/config.js": "conteúdo completo com novas DEXs"}}`;
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

  // Garantir que o bot está funcional
  await guardian();

  // Ciclos independentes
  setInterval(guardian, GUARDIAN_INTERVAL_MS);
  setInterval(profitAnalyst, OPTIMIZER_INTERVAL_MS);
  setInterval(expansor, EXPANSOR_INTERVAL_MS);

  // Manter o processo vivo
  while (true) {
    await new Promise(r => setTimeout(r, 60000));
    console.log('⏱️ Equipa ativa...');
  }
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  setTimeout(main, 60000);
});