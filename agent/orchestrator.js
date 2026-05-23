// agent/orchestrator.js
require('dotenv').config();
const { extractJson } = require('./utils/deepseek');
const { startBot, isBotRunning } = require('./utils/botControl');
const analyst = require('./roles/analyst');
const developer = require('./roles/developer');
const qa = require('./roles/qa');
const devops = require('./roles/devops');

async function main() {
  console.log('🤖 Super Equipa de Agentes iniciada.');
  console.log('⏰', new Date().toISOString());

  // DevOps: garante que o bot está a correr
  if (!isBotRunning()) {
    devops.startBot();
    console.log('⏳ Aguardar 60s para o bot gerar logs...');
    await new Promise(r => setTimeout(r, 60000));
  }

  // 1. Analista
  const analysisRaw = await analyst.analyse();
  const analysisJson = extractJson(analysisRaw);
  if (!analysisJson) {
    console.log('⚠️ Analista não retornou JSON.');
    return;
  }
  console.log('📋 Análise:', analysisJson.summary);

  // 2. Developer + QA com até 3 tentativas
  let generatedJson = null;
  let reviewJson = null;
  for (let i = 1; i <= 3; i++) {
    console.log(`🔄 Tentativa ${i}/3`);
    const devRaw = await developer.develop(
      JSON.stringify(analysisJson),
      reviewJson ? JSON.stringify(reviewJson.issues) : null
    );
    generatedJson = extractJson(devRaw);
    if (!generatedJson?.files) {
      console.log('⚠️ Developer não gerou JSON.');
      continue;
    }
    const qaRaw = await qa.review(generatedJson);
    reviewJson = extractJson(qaRaw);
    if (!reviewJson) continue;
    if (reviewJson.approved) {
      console.log('✅ QA aprovou!');
      break;
    }
    console.log(`❌ QA rejeitou: ${reviewJson.issues?.join(', ')}`);
  }

  // 3. Aplicar se aprovado
  if (reviewJson?.approved && generatedJson?.files) {
    devops.applyChanges(generatedJson.files);
    devops.gitCommit(generatedJson.commitMessage || '🤖 update');
    console.log('🔄 Reiniciar bot com novo código...');
    devops.restartBot();
  } else {
    console.log('❌ Alterações não aprovadas.');
  }

  console.log('🏁 Ciclo concluído.');
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});