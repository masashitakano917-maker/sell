import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `あなたは中古衣料・バッグの目利きです。商品画像から、商品の状態（キズ・汚れ・型崩れ・タグ有無など）を中心に確認し、必ずJSONで返してください。
ブランド・服種類・サイズ・素材は出品者が手入力するため、画像から推測できる範囲のみ返却。確認できない項目は null。日本語で。

スキーマ:
{
  "brand": string|null,
  "category": string|null,
  "itemType": string|null,
  "size": string|null,
  "material": string|null,
  "condition": string|null,
  "hasTag": boolean|null,
  "hasDamage": boolean|null,
  "damageDetails": string|null,
  "searchHints": string[]
}

- condition は "新品・未使用" / "未使用に近い" / "美品" / "目立った傷や汚れなし" / "やや傷や汚れあり" / "傷や汚れあり" / "全体的に状態が悪い" のいずれか。画像から判定できなければ null。
- hasDamage は明確なキズ・シミ・汚れ・毛羽立ち・型崩れがあれば true。なければ false。判別できなければ null。
- damageDetails は hasDamage=true のときに具体的な箇所と種類を簡潔に（例：「右袖口に黒い汚れ」「襟に毛玉」）。なければ null。
- hasTag は新品タグ（値札）が画像に写っているなら true、無ければ false、判別できなければ null。
- searchHints はメルカリ等の検索を絞り込むための短い特徴語を最大3つ。色（例：「黒」「ベージュ」）／柄（例：「ボーダー」「花柄」「無地」）／シルエット（例：「ロング」「ノースリーブ」）／素材外観（例：「コーデュロイ」「キルティング」）など、画像から確信できる識別性の高い単語のみ。確信が無ければ空配列。ブランド名・服種類・サイズはここに入れない。`;

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

    const model = "gemini-2.5-flash";
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
