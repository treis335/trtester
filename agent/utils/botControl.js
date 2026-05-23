// agent/utils/botControl.js
const { spawn } = require('child_process');
const path = require('path');

let botProcess = null;

function startBot() {
  if (botProcess) {
    console.log('⚠️ Bot já está a correr.');
    return;
  }
  console.log('🚀 Iniciar bot de arbitragem...');
  botProcess = spawn('node', ['index.js'], {
    cwd: path.join(__dirname, '..', '..'),
    stdio: 'ignore', // ou 'pipe' para capturar logs
  });
  botProcess.on('exit', (code) => {
    console.log(`Bot parou com código ${code}`);
    botProcess = null;
  });
}

function stopBot() {
  if (!botProcess) {
    console.log('⚠️ Bot não está a correr.');
    return;
  }
  console.log('🛑 Parar bot...');
  botProcess.kill('SIGTERM');
  botProcess = null;
}

function isBotRunning() {
  return botProcess !== null && botProcess.exitCode === null;
}

module.exports = { startBot, stopBot, isBotRunning };