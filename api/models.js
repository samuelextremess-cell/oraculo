module.exports = async (_req, res) => {
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
};
