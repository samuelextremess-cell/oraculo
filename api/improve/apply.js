const { callDeepSeek } = require('../_lib.js');
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  try {
    const { analysis, files } = req.body;
    if (!analysis || !files) throw new Error('Envie { analysis, files }.');

    const fileList = Object.keys(files).join(', ');
    const prompt = `Com base na análise abaixo, reescreva **completamente** cada arquivo com as melhorias aplicadas. Retorne APENAS um JSON válido neste formato, sem texto adicional:

{
  "public/index.html": "<conteúdo completo>",
  "server.js": "<conteúdo completo>"
}

Análise:
${analysis}

Arquivos a melhorar: ${fileList}`;

    const raw = await callDeepSeek(prompt, {
      systemMessage: 'Você é um gerador de código. Retorne apenas JSON puro, sem markdown, sem explicações. O JSON deve conter o conteúdo completo de cada arquivo com todas as melhorias aplicadas.',
      maxTokens: 8000
    });

    let improved;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) improved = JSON.parse(jsonMatch[0]);
    else improved = JSON.parse(raw);

    const root = process.cwd();
    const results = [];
    for (const [filename, content] of Object.entries(improved)) {
      if (!['public/index.html', 'server.js'].includes(filename)) continue;
      fs.writeFileSync(path.join(root, filename), content, 'utf-8');
      results.push(filename);
    }

    res.json({ ok: true, applied: results, message: `${results.length} arquivo(s) atualizado(s).` });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao aplicar: ' + err.message });
  }
};
