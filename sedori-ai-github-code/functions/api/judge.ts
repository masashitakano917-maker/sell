// Cloudflare Pages Function placeholder.
// Static UI already performs rule-based judgment in the browser.
// Later, connect image analysis / LLM judgment here so API keys stay server-side.

type Env = {
  OPENAI_API_KEY?: string;
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const payload = await context.request.json().catch(() => null);
  if (!payload) {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // MVP: echo back structured payload. Add external AI API call here when ready.
  return Response.json({
    ok: true,
    mode: 'rule_based_mvp',
    message: 'Client-side master judgment is active. Server-side AI can be added here.',
    received: payload,
  });
};
