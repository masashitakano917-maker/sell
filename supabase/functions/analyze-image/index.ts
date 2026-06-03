import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `あなたは中古衣料・バッグの目利きです。商品画像から以下を抽出し、必ずJSONで返してください。
未確認なら null。日本語で。
スキーマ:
{
  "brand": string|null,
  "category": string|null,
  "itemType": string|null,
  "size": string|null,
  "material": string|null,
  "condition": string|null,
  "hasTag": boolean|null,
  "hasDamage": boolean|null
}
category は "レディース服" / "メンズ服" / "バッグ・小物" / "靴" / "高級ブランド" / "キッズ" / "スポーツ・アウトドア" のいずれか。
itemType は "ワンピース" / "ブラウス・シャツ" / "ニット・カーディガン" / "アウター" / "パンツ" / "スカート" / "スーツ・セットアップ" / "バッグ" / "財布・小物" / "靴" / "スポーツウェア" のいずれか。
condition は "新品・未使用" / "未使用に近い" / "美品" / "目立った傷や汚れなし" / "やや傷や汚れあり" / "傷や汚れあり" / "全体的に状態が悪い" のいずれか。`;

type DataUrl = string;

function parseDataUrl(s: DataUrl): { mime: string; data: string } | null {
  const m = s.match(/^data:([^;,]+);base64,(.*)$/);
  if (!m) return null;
  return { mime: m[1], data: m[2] };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured. Set it as an Edge Function secret." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { images } = (await req.json()) as { images: DataUrl[] };
    if (!Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "images required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limited = images.slice(0, 6);
    const parts: Array<Record<string, unknown>> = [
      { text: "次の商品画像から指定スキーマのJSONだけを返してください。" },
    ];
    for (const url of limited) {
      const parsed = parseDataUrl(url);
      if (!parsed) continue;
      parts.push({ inline_data: { mime_type: parsed.mime, data: parsed.data } });
    }

    const model = "gemini-2.0-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const aiRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: "application/json",
        },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({
            error: "GeminiのAPI無料枠を使い切りました。Google AI Studioで課金プランへ切り替えるか、24時間ほど待ってから再試行してください。",
            code: "QUOTA_EXCEEDED",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: `Gemini ${aiRes.status}: ${errText}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const text = aiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* noop */ }
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
