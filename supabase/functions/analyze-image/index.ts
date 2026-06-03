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
  "brand": string|null,           // 例 "CELFORD" / "GUCCI"
  "category": string|null,        // "レディース服" / "メンズ服" / "バッグ・小物" / "靴" / "高級ブランド" / "キッズ" / "スポーツ・アウトドア"
  "itemType": string|null,        // "ワンピース" / "ブラウス・シャツ" / "ニット・カーディガン" / "アウター" / "パンツ" / "スカート" / "スーツ・セットアップ" / "バッグ" / "財布・小物" / "靴" / "スポーツウェア"
  "size": string|null,            // 例 "38" / "M"
  "material": string|null,        // 例 "シルク100%"
  "condition": string|null,       // "新品・未使用" / "未使用に近い" / "美品" / "目立った傷や汚れなし" / "やや傷や汚れあり" / "傷や汚れあり" / "全体的に状態が悪い"
  "hasTag": boolean|null,         // 値札・タグが付いているか
  "hasDamage": boolean|null       // 明確なダメージが見えるか
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not configured. Set it as an Edge Function secret." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { images } = (await req.json()) as { images: string[] };
    if (!Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "images required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limited = images.slice(0, 6);
    const userContent: Array<Record<string, unknown>> = [
      { type: "text", text: "次の商品画像から指定スキーマのJSONだけを返してください。" },
      ...limited.map((url) => ({ type: "image_url", image_url: { url } })),
    ];

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return new Response(JSON.stringify({ error: `OpenAI ${aiRes.status}: ${errText}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const content = aiData?.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
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
