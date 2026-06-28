const { callDeepSeek, callHuggingFace, detectBestModel } = require('../_lib.js');

module.exports = async (req, res) => {
  const prompt = req.body.prompt;
  const bestModel = detectBestModel(prompt);

  if (bestModel === '__deepseek__') {
    try {
      const reply = await callDeepSeek(prompt);
      return res.json({ reply, model: 'deepseek-chat (auto)' });
    } catch { /* fallback */ }
  }

  if (!process.env.HF_TOKEN) return res.status(500).json({ error: 'HF_TOKEN não configurado' });

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
};
