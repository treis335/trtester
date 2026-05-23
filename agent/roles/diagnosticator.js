// agent/roles/diagnosticator.js
const fs = require('fs');
const { callDeepSeek } = require('../utils/deepseek');
const config = require('../config');

async function diagnose() {
  console.log('🔍 Diagnosticador a verificar saúde do bot...');
  const errors = fs.existsSync(config.paths.errorLog)
    ? fs.readFileSync(config.paths.errorLog, 'utf8').slice(-5000)
    : 'sem erros';
  const metrics = fs.existsSync(config.paths.metrics)
    ? fs.readFileSync(config.paths.metrics, 'utf8').slice(-2000)
    : 'sem métricas';

  // Verificação rápida sem IA para erros críticos
  if (errors.includes('SyntaxError') || errors.includes('CONFIG has already been declared')) {
    return {
      critical: true,
      summary: 'Erro de sintaxe no config.js — declaração duplicada ou ficheiro corrompido.',
      actions: ['Reverter config.js para último backup', 'Corrigir duplicação de declarações'],
    };
  }
  if (errors.includes('insufficient balance') || errors.includes('402')) {
    return {
      critical: true,
      summary: 'Saldo insuficiente na API DeepSeek ou na wallet.',
      actions: ['Notificar utilizador para verificar saldo', 'Pausar ciclos até reposição'],
    };
  }

  const prompt = `
És um diagnosticador de sistemas. Analisa os logs de erro e métricas do bot de arbitragem e determina se há problemas críticos que precisam de intervenção imediata.

ERROS (últimas 5000 chars):
${errors}

MÉTRICAS (últimas 2000 chars):
${metrics}

Responde APENAS com JSON:
{
  "critical": true/false,
  "summary": "descrição do problema principal, se existir",
  "actions": ["acção 1", "acção 2"]
}`;

  const response = await callDeepSeek('És um diagnosticador de sistemas.', prompt);
  return response;
}

module.exports = { diagnose };