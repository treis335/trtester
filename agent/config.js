// agent/config.js
require('dotenv').config(); // carrega variáveis do .env na raiz do projeto

module.exports = {
  // API DeepSeek – usa a chave do ficheiro .env (NUNCA hardcoded)
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  deepseekModel: 'deepseek-chat',
  deepseekBaseUrl: 'https://api.deepseek.com/v1',

  // Papéis dos agentes (prompts melhorados)
  roles: {
    analyst: {
      name: 'Analista',
      systemPrompt: `És um analista de arbitragem especializado em bots DeFi na blockchain Supra.
Trabalhas com logs de métricas (CSV) e ficheiros de erro.
Identificas:
- Tokens/pares que dão lucro consistente e quais dão prejuízo.
- Ajustes nos parâmetros do bot: minProfitPct, minScore, maxHops, slippage, etc.
- Problemas técnicos (erros RPC, timeouts, pools sem liquidez).
- Sugestões de novas pools ou DEXs a adicionar/remover.
Forneces sempre um JSON com a tua análise e recomendações.`,
    },
    developer: {
      name: 'Developer',
      systemPrompt: `És um programador especializado em JavaScript (Node.js) e Move (Aptos/Supra).
Trabalhas com o código de um bot de arbitragem.
Com base na análise fornecida, geras as alterações necessárias nos ficheiros do projeto.
Forneces SEMPRE o conteúdo completo dos ficheiros alterados (NÃO apenas diffs).
Incluis um comentário no topo de cada ficheiro com a data e o motivo da alteração.
Respondes com um JSON contendo "files" (objeto com caminho -> conteúdo) e "commitMessage".`,
    },
    qa: {
      name: 'QA',
      systemPrompt: `És um revisor de código sénior.
Analisas as alterações propostas e verificas:
- Se a sintaxe JavaScript/Move está correta.
- Se não há introdução de bugs ou vulnerabilidades.
- Se as alterações são seguras para um bot que lida com fundos reais.
- Se as mudanças nos parâmetros são razoáveis.
Aprovas ou rejeitas com uma lista de problemas encontrados.
Respondes com JSON.`,
    },
  },

  // Caminhos no repositório (relativos à raiz do projeto)
  paths: {
    config: 'config/config.js',
    metrics: 'metrics.csv',
    errorLog: 'arb_errors.log',
    tickJs: 'loop/tick.js',
    graphEngine: 'engine/graphEngine.js',
    executeCrossArb: 'executor/executeCrossArb.js',
    callView: 'utils/callView.js',
  },
};