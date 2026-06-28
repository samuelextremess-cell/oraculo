const { callDeepSeek } = require('../_lib.js');
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  try {
    const root = process.cwd();
    const files = ['public/index.html', 'server.js'];
    const sources = {};
    files.forEach(f => {
      try { sources[f] = fs.readFileSync(path.join(root, f), 'utf-8'); }
      catch { sources[f] = ''; }
    });

    const prompt = `Analise o seguinte código do projeto Oráculo (chat IA multi-modelo) e sugira melhorias concretas. Para cada sugestão, indique:

1. Nome do arquivo
2. Linha aproximada
3. O que mudar e por quê
4. O novo código sugerido (em bloco de código)

Seja específico e prático. Priorize bugs, performance e UX.

--- public/index.html ---
${sources['public/index.html']}

--- server.js ---
${sources['server.js']}`;

    const analysis = await callDeepSeek(prompt, {
      systemMessage: 'Você é um engenheiro de software sênior especializado em revisão de código. Analise o código e forneça sugestões de melhoria detalhadas, específicas e acionáveis. Seja direto. Responda em português.',
      maxTokens: 4000
    });

    res.json({ analysis, files: sources });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
