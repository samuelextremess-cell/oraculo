const { callDeepSeek } = require('../_lib.js');

module.exports = async (req, res) => {
  try {
    const reply = await callDeepSeek(req.body.prompt);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
