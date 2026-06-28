require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ═══════════════════════════════════════
//  Funções de chamada às APIs
// ═══════════════════════════════════════

async function callDeepSeek(userText, opts = {}) {
  const token = process.env.DS_TOKEN;
  if (!token) throw new Error('DS_TOKEN não configurado no .env');

  const systemMsg = opts.systemMessage ||
    'Você é o Oráculo, um assistente útil e direto. Responda sempre em português.';
  const maxTok = opts.maxTokens || 1000;

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userText }
      ],
      temperature: 0.7,
      max_tokens: maxTok
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DeepSeek HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callHuggingFace(modelId, userText) {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error('HF_TOKEN não configurado no .env');

  const response = await fetch(
    `https://api-inference.huggingface.co/models/${modelId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: userText,
        parameters: { max_new_tokens: 500 }
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HuggingFace HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = await response.json();

  if (Array.isArray(data)) {
    return data[0]?.generated_text || JSON.stringify(data);
  }
  if (data?.generated_text) {
    return data.generated_text;
  }
  if (data?.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }

  throw new Error('Formato de resposta inesperado do HuggingFace.');
}

// ── DeepSeek (API oficial) ──
app.post('/api/chat/deepseek', async (req, res) => {
  try {
    const reply = await callDeepSeek(req.body.prompt);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Detector automático de melhor modelo baseado no conteúdo ──
function detectBestModel(prompt) {
  const t = prompt.toLowerCase().trim();
  const len = prompt.trim().length;

  const progKw = ['código','code','função','function','python','javascript','js','html','css',
    'api','bug','erro','error','debug','compilar','compile','script','classe','class','import',
    'export','npm','git','docker','sql','banco de dados','algoritmo','algorithm','loop','array',
    'json','react','node','typescript','rust','golang','java','c++','ruby',
    'programação','programming','console','log','server','servidor','client','cliente',
    'endpoint','rota','route','framework','biblioteca','library','regex','linux','bash'];
  if (progKw.some(k => t.includes(k))) return '__deepseek__';

  const tradKw = ['traduz','tradução','translate','traduza','em português','em inglês',
    'em espanhol','em francês','to portuguese','to english','to spanish','traduza para'];
  if (tradKw.some(k => t.includes(k))) return 'google/flan-t5-large';

  if (len < 30) return 'microsoft/DialoGPT-medium';

  const criatKw = ['história','story','conto','criativ','creativ','poema','poem','poesia',
    'poetry','imagina','imagine','ficção','fiction','fantasia','fantasy','roteiro','script',
    'narrativa','narrative','personagem','character','cena','scene','romance','drama',
    'mistério','mystery','aventura','adventure','mundo','magia','magic','escreva','write',
    'crie','create','invente','lenda','legend','épico','epic','fábula','fable'];
  if (criatKw.some(k => t.includes(k))) return 'mistralai/Mistral-7B-Instruct-v0.2';

  return '__deepseek__';
}

// ── Auto (detecta melhor modelo + fallback) ──
app.post('/api/chat/auto', async (req, res) => {
  const prompt = req.body.prompt;
  const bestModel = detectBestModel(prompt);

  if (bestModel === '__deepseek__') {
    try {
      const reply = await callDeepSeek(prompt);
      return res.json({ reply, model: 'deepseek-chat (auto)' });
    } catch { /* cai para fallback HF */ }
  }

  if (!process.env.HF_TOKEN) return res.status(500).json({ error: 'HF_TOKEN não configurado no .env' });

  const candidates = (bestModel === '__deepseek__' ? [] : [bestModel]).concat([
    'deepseek-ai/DeepSeek-V3',
    'Qwen/Qwen2.5-72B-Instruct',
    'mistralai/Mistral-7B-Instruct-v0.2',
    'microsoft/DialoGPT-medium',
    'google/flan-t5-large'
  ]);
  const hfModels = [...new Set(candidates)];

  for (const modelId of hfModels) {
    try {
      const reply = await callHuggingFace(modelId, prompt);
      return res.json({ reply, model: modelId + ' (auto)' });
    } catch { continue; }
  }

  res.status(500).json({ error: 'Nenhum modelo disponível no momento.' });
});

// ── Listar modelos do Hugging Face ──
app.get('/api/models', async (_req, res) => {
  try {
    const hfRes = await fetch(
      'https://huggingface.co/api/models?pipeline_tag=text-generation&sort=downloads&direction=-1&limit=20&full=false',
      { headers: { 'User-Agent': 'oraculo/1.0' } }
    );
    if (!hfRes.ok) throw new Error(`HuggingFace HTTP ${hfRes.status}`);
    const all = await hfRes.json();
    const models = all
      .filter(m => m.pipeline_tag === 'text-generation' && !m.private && !m.gated)
      .slice(0, 18)
      .map(m => ({
        id: m.id,
        downloads: m.downloads || 0,
        likes: m.likes || 0,
        author: m.author || m.id.split('/')[0]
      }));
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Chat com modelo específico do Hugging Face ──
app.post('/api/chat/huggingface', async (req, res) => {
  try {
    if (!req.body.model) throw new Error('Envie { model, prompt } no corpo da requisição.');
    const reply = await callHuggingFace(req.body.model, req.body.prompt);
    res.json({ reply, model: req.body.model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Salvar no GitHub ──
app.post('/api/github/save', async (req, res) => {
  try {
    const token  = process.env.GITHUB_TOKEN;
    const repo   = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';

    if (!token) throw new Error('GITHUB_TOKEN não configurado no .env');
    if (!repo)  throw new Error('GITHUB_REPO não configurado no .env');
    if (!req.body.messages || !Array.isArray(req.body.messages)) {
      throw new Error('Envie { messages: [...] } no corpo da requisição.');
    }

    const ts    = new Date().toISOString().replace(/[:.]/g, '-');
    const path  = `chats/oraculo-${ts}.json`;
    const content = Buffer.from(JSON.stringify(req.body.messages, null, 2)).toString('base64');

    const ghRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Content-Type':   'application/json',
        'Accept':         'application/vnd.github+json'
      },
      body: JSON.stringify({
        message: `Oráculo: chat salvo em ${new Date().toLocaleString('pt-BR')}`,
        content,
        branch
      })
    });

    if (!ghRes.ok) {
      const errData = await ghRes.json().catch(() => ({}));
      throw new Error(errData.message || `GitHub HTTP ${ghRes.status}`);
    }

    res.json({ ok: true, path, message: 'Chat salvo no GitHub com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Auto-melhoria: retorna código fonte ──
app.get('/api/source', (_req, res) => {
  try {
    const files = ['index.html', 'server.js'];
    const sources = {};
    files.forEach(f => {
      sources[f] = fs.readFileSync(path.join(__dirname, f), 'utf-8');
    });
    res.json({ files: sources });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Auto-melhoria: analisa código e retorna sugestões ──
app.post('/api/improve/analyze', async (req, res) => {
  try {
    const files = ['index.html', 'server.js'];
    const sources = {};
    files.forEach(f => {
      sources[f] = fs.readFileSync(path.join(__dirname, f), 'utf-8');
    });

    const prompt = `Analise o seguinte código do projeto Oráculo (chat IA multi-modelo) e sugira melhorias concretas. Para cada sugestão, indique:

1. Nome do arquivo
2. Linha aproximada
3. O que mudar e por quê
4. O novo código sugerido (em bloco de código)

Seja específico e prático. Priorize bugs, performance e UX.

--- index.html ---
${sources['index.html']}

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
});

// ── Auto-melhoria: aplica código melhorado ──
app.post('/api/improve/apply', async (req, res) => {
  try {
    const { analysis, files } = req.body;
    if (!analysis || !files) throw new Error('Envie { analysis, files } no corpo.');

    const fileList = Object.keys(files).join(', ');
    const prompt = `Com base na análise abaixo, reescreva **completamente** cada arquivo com as melhorias aplicadas. Retorne APENAS um JSON válido neste formato, sem texto adicional:

{
  "index.html": "<conteúdo completo do arquivo>",
  "server.js": "<conteúdo completo do arquivo>"
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
    if (jsonMatch) {
      improved = JSON.parse(jsonMatch[0]);
    } else {
      improved = JSON.parse(raw);
    }

    const results = [];
    for (const [filename, content] of Object.entries(improved)) {
      const filePath = path.join(__dirname, filename);
      if (!['public/index.html', 'server.js'].includes(filename)) continue;
      fs.writeFileSync(filePath, content, 'utf-8');
      results.push(filename);
    }

    res.json({ ok: true, applied: results, message: `${results.length} arquivo(s) atualizado(s). Reinicie o servidor.` });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao aplicar: ' + err.message });
  }
});

// ── Serve arquivos estáticos (apenas dev local) ──
if (require.main === module) {
  app.use(express.static(__dirname));
}

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Oráculo rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;
