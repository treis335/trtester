// agent/roles/devops.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { startBot, stopBot, isBotRunning } = require('../utils/botControl');

function applyChanges(files) {
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(__dirname, '..', '..', filePath);
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`📝 ${filePath} atualizado.`);
  }
}

function restartBot() {
  if (isBotRunning()) stopBot();
  setTimeout(() => startBot(), 2000);
}

function gitCommit(commitMessage) {
  try {
    execSync('git add -A', { cwd: path.join(__dirname, '..', '..') });
    execSync(`git commit -m "${commitMessage}"`, { cwd: path.join(__dirname, '..', '..') });
    console.log('✅ Commit local criado.');
  } catch (e) {
    console.error('⚠️ Erro no commit:', e.message);
  }
}

module.exports = { applyChanges, restartBot, gitCommit, startBot, stopBot };