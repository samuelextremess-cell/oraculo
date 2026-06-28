// ── Funções compartilhadas para Vercel serverless ──

async function callDeepSeek(userText, opts = {}) {
  const token = process.env.DS_TOKEN;
  if (!token) throw new Error('DS_TOKEN não configurado');

  const systemMsg = opts.systemMessage ||
    'Você é o Oráculo, um assistente útil e direto. Responda sempre em português.';
  const maxTok = opts.maxTokens || 1000;

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
  if (!token) throw new Error('HF_TOKEN não configurado');

  const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: userText,
      parameters: { max_new_tokens: 500 }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HuggingFace HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  if (Array.isArray(data)) return data[0]?.generated_text || JSON.stringify(data);
  if (data?.generated_text) return data.generated_text;
  if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
  throw new Error('Formato de resposta inesperado do HuggingFace.');
}

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

module.exports = { callDeepSeek, callHuggingFace, detectBestModel };
