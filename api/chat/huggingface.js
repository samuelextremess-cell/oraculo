const { callHuggingFace } = require('../_lib.js');

module.exports = async (req, res) => {
  try {
    if (!req.body.model) throw new Error('Envie { model, prompt }.');
    const reply = await callHuggingFace(req.body.model, req.body.prompt);
    res.json({ reply, model: req.body.model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
