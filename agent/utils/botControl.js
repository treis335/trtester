// agent/utils/botControl.js
const { spawn } = require('child_process');
const path = require('path');

let botProcess = null;

function startBot() {
  if (botProcess && botProcess.exitCode === null) {
    console.log('⚠️ Bot já está a correr.');
    return;
  }
  console.log('🚀 A iniciar o bot de arbitragem...');
  botProcess = spawn('node', ['index.js'], {
    cwd: path.join(__dirname, '..', '..'),
    stdio: 'inherit',
  });
  botProcess.on('exit', (code) => {
    console.log(`🛑 Bot parou com código ${code}`);
    botProcess = null;
  });
  botProcess.on('error', (err) => {
    console.error('❌ Erro ao iniciar bot:', err.message);
    botProcess = null;
  });
}

function stopBot() {
  if (!botProcess || botProcess.exitCode !== null) {
    console.log('⚠️ Bot não está a correr.');
    return;
  }
  console.log('🛑 A parar bot...');
  botProcess.kill('SIGTERM');
  setTimeout(() => {
    if (botProcess && botProcess.exitCode === null) {
      botProcess.kill('SIGKILL');
    }
  }, 5000);
}

function isBotRunning() {
  return botProcess !== null && botProcess.exitCode === null;
}

module.exports = { startBot, stopBot, isBotRunning };