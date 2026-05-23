// agent/orchestrator.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { extractJson } = require('./utils/deepseek');
const { startBot, stopBot, isBotRunning } = require('./utils/botControl');
const config = require('./config');
const memory = require('./memory');
const planner = require('./roles/planner');
const analyst = require('./roles/analyst');
const diagnosticator = require('./roles/diagnosticator');
const investigator = require('./roles/investigator');
const developer = require('./roles/developer');
const qa = require('./roles/qa');
const narrator = require('./roles/narrator');
const devops = require('./roles/devops');

const CYCLE_INTERVAL_MS = config.cycleIntervalMs;

// ─── Segurança ────────────────────────────────────────────
function configIsSafe(content) {
  return content.includes('tokens:') && content.includes('SUPRA:') && content.includes('DEXUSDC:') && (content.match(/const CONFIG\s*=\s*\{/g) || []).length === 1;
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

function pullLatest() {
  try { execSync('git pull origin main', { stdio: 'ignore' }); } catch {}
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

// ─── Narrativas ──────────────────────────────────────────
function addNarrative(entry) {
  const log = memory.get('narrativeLog') || [];
  log.push({ timestamp: new Date().toISOString(), ...entry });
  memory.set('narrativeLog', log.slice(-50));
  fs.appendFileSync('narratives.jsonl', JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n');
}

// ─── DEXs disponíveis ────────────────────────────────────
function getAvailableDEXs() {
  const dexesPath = path.join(__dirname, '..', config.paths.dexesDir);
  if (!fs.existsSync(dexesPath)) return [];
  return fs.readdirSync(dexesPath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name.toUpperCase());
}

// ─── Ciclo de emergência (auto‑reparação) ────────────────
async function emergencyCycle(diagnosis) {
  console.log('🚨 Ciclo de emergência iniciado!');
  addNarrative({ title: '🚨 Alerta', body: `Problema crítico: ${diagnosis.summary}. A equipa está a trabalhar na correção.`, emoji: '🚨' });

  const currentConfig = fs.existsSync(config.paths.config) ? fs.readFileSync(config.paths.config, 'utf8') : '';

  // Investigar causa raiz
  let investigationJson;
  try {
    const invRaw = await investigator.investigate(diagnosis.summary, currentConfig);
    investigationJson = extractJson(invRaw);
  } catch (e) { console.error('❌ Investigador:', e.message); return false; }
  if (!investigationJson?.fix) {
    console.log('❌ Investigador não encontrou correção.');
    return false;
  }

  // Aplicar correção diretamente (sem QA em emergência, mas com backup)
  backupFiles(investigationJson.fix.files);
  const ts = Date.now();
  try {
    devops.applyChanges(investigationJson.fix.files);
    devops.gitCommit(investigationJson.fix.commitMessage || '🚑 hotfix');
    stopBot(); await new Promise(r => setTimeout(r, 3000));
    startBot(); await new Promise(r => setTimeout(r, 10000));
    if (isBotRunning()) {
      addNarrative({ title: '✅ Corrigido', body: `O problema foi resolvido: ${investigationJson.fix.commitMessage}`, emoji: '✅' });
      return true;
    } else {
      restoreBackup(ts);
      startBot();
      addNarrative({ title: '❌ Falha na correção', body: 'A correção falhou e foi revertida.', emoji: '⚠️' });
      return false;
    }
  } catch (e) {
    restoreBackup(ts); startBot();
    return false;
  }
}

// ─── Ciclo normal (expansão) ─────────────────────────────
async function normalCycle() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 Ciclo normal de expansão');
  console.log('⏰', new Date().toISOString());
  pullLatest();

  if (!isBotRunning()) {
    startBot();
    await new Promise(r => setTimeout(r, 30000));
  }

  // Analista
  let analysisJson;
  try {
    const raw = await analyst.analyse();
    analysisJson = extractJson(raw);
  } catch (e) { console.error('❌ Analista:', e.message); return; }
  if (!analysisJson) return;
  console.log('📋 Análise:', analysisJson.summary);
  try {
    const narRaw = await narrator.narrate({ type: 'analysis', data: analysisJson });
    const narJson = extractJson(narRaw);
    if (narJson) addNarrative(narJson);
  } catch {}

  // Planeador
  const currentConfig = fs.existsSync(config.paths.config) ? fs.readFileSync(config.paths.config, 'utf8') : '';
  let planJson;
  try {
    const raw = await planner.plan(analysisJson, currentConfig);
    planJson = extractJson(raw);
  } catch (e) { console.error('❌ Planeador:', e.message); return; }
  if (!planJson) return;
  console.log('🎯 Plano:', planJson.goals?.join(', '));
  try {
    const narRaw = await narrator.narrate({ type: 'plan', data: planJson });
    const narJson = extractJson(narRaw);
    if (narJson) addNarrative(narJson);
  } catch {}

  // Developer + QA
  let generatedJson = null, reviewJson = null;
  for (let i = 1; i <= 3; i++) {
    try {
      const devRaw = await developer.develop(
        JSON.stringify({ analysis: analysisJson, plan: planJson, availableDEXs: getAvailableDEXs(), hasTelegram: !!config.telegramBotToken }),
        reviewJson ? JSON.stringify(reviewJson.issues) : null
      );
      generatedJson = extractJson(devRaw);
    } catch (e) { continue; }
    if (!generatedJson?.files) continue;
    if (generatedJson.files['config/config.js'] && !configIsSafe(generatedJson.files['config/config.js'])) {
      reviewJson = { approved: false, issues: ['config inseguro'] }; continue;
    }
    try {
      const qaRaw = await qa.review(generatedJson);
      reviewJson = extractJson(qaRaw);
    } catch (e) { continue; }
    if (reviewJson?.approved) break;
  }

  if (reviewJson?.approved && generatedJson?.files) {
    try {
      const narRaw = await narrator.narrate({ type: 'approved', plan: planJson.goals, commitMessage: generatedJson.commitMessage });
      const narJson = extractJson(narRaw);
      if (narJson) addNarrative(narJson);
    } catch {}
    backupFiles(generatedJson.files);
    const ts = Date.now();
    try {
      devops.applyChanges(generatedJson.files);
      devops.gitCommit(generatedJson.commitMessage || '🤖 update');
      stopDashboard(); stopTelegramBot(); stopBot();
      await new Promise(r => setTimeout(r, 3000));
      startBot(); startDashboard(); startTelegramBot();
      await new Promise(r => setTimeout(r, 10000));
      if (!isBotRunning()) {
        restoreBackup(ts); startBot();
        addNarrative({ title: '❌ Falha na atualização', body: 'O bot não arrancou com as alterações. Foi feita reversão automática.', emoji: '⚠️' });
      } else {
        const history = memory.get('history') || [];
        history.push({ timestamp: new Date().toISOString(), summary: analysisJson.summary, goals: planJson.goals, commitMessage: generatedJson.commitMessage });
        memory.set('history', history.slice(-30));
      }
    } catch (e) { restoreBackup(ts); startBot(); }
  } else {
    addNarrative({ title: '💤 Ciclo sem alterações', body: 'Nenhuma alteração aprovada.', emoji: '😴' });
    const history = memory.get('history') || [];
    history.push({ timestamp: new Date().toISOString(), summary: analysisJson.summary, goals: planJson.goals, approved: false });
    memory.set('history', history.slice(-30));
  }
}

// ─── Orquestrador principal ──────────────────────────────
async function main() {
  console.log('🚀 Equipa Autónoma de Inovação iniciada.');
  memory.load();
  try { fs.writeFileSync('narratives.jsonl', ''); } catch {}
  startDashboard();
  startTelegramBot();

  // Loop infinito
  while (true) {
    // 1. Diagnosticar antes de cada ciclo
    let diagnosisJson;
    try {
      const diagRaw = await diagnosticator.diagnose();
      diagnosisJson = extractJson(diagRaw);
    } catch (e) {
      console.error('❌ Diagnosticador:', e.message);
      diagnosisJson = { critical: false };
    }

    if (diagnosisJson?.critical) {
      console.log('🚨 Modo de emergência ativado.');
      const fixed = await emergencyCycle(diagnosisJson);
      if (!fixed) {
        addNarrative({ title: '⚠️ Falha na auto‑reparação', body: 'A equipa não conseguiu corrigir o problema automaticamente. É necessária intervenção manual.', emoji: '🆘' });
      }
    } else {
      // Ciclo normal de expansão
      await normalCycle();
    }

    // Aguardar até ao próximo ciclo
    console.log(`⏳ Próximo ciclo em ${CYCLE_INTERVAL_MS / 60000} minutos.`);
    await new Promise(r => setTimeout(r, CYCLE_INTERVAL_MS));
  }
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  setTimeout(main, 60000);
});