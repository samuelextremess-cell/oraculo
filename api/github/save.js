module.exports = async (req, res) => {
  try {
    const token  = process.env.GITHUB_TOKEN;
    const repo   = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';

    if (!token) throw new Error('GITHUB_TOKEN não configurado');
    if (!repo)  throw new Error('GITHUB_REPO não configurado');
    if (!req.body.messages || !Array.isArray(req.body.messages)) {
      throw new Error('Envie { messages: [...] }.');
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = `chats/oraculo-${ts}.json`;
    const content = Buffer.from(JSON.stringify(req.body.messages, null, 2)).toString('base64');

    const ghRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json'
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

    res.json({ ok: true, path: filePath, message: 'Chat salvo no GitHub.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
