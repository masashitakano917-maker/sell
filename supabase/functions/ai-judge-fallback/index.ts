import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `あなたは日本の中古アパレル・バッグ・古着せどりの専門家です。
ユーザーは仕入れ判定を行いたいが、メルカリ・Yahoo!フリマの売り切れ相場が0件で、当アプリのマスターにも該当データがありません。
そこであなたは、自分の知識（ブランドの一般的な中古相場、Yahoo!オークション、ラクマ、ZOZOUSEDなどの公開情報、ブランドの定価帯、人気度、需要傾向、季節性、真贋リスク、状態リスクなど）を総動員し、信頼できる範囲で参考相場と判定を返します。

必ず日本語で、必ず JSON のみを返してください。前置き・後置きの文章・コードフェンス禁止。

スキーマ:
{
  "estimatedSaleMin": number,    // 中古フリマでの想定下限売価（円）
  "estimatedSaleMax": number,    // 中古フリマでの想定上限売価（円）
  "decision": "買い" | "条件付き買い" | "慎重" | "見送り",
  "confidence": "low" | "medium" | "high",
  "reasoning": string,           // 200〜400字の根拠説明（日本語）
  "sources": string[],           // 想定した情報源・参照（例: "Yahoo!オークション一般相場", "ブランド公式定価帯", "ZOZOUSED中古相場感"）
  "risks": string[],             // 注意点（真贋・劣化・需要薄など）
  "recommendation": string       // 1〜2文の最終アドバイス
}

判断ルール:
- 仕入れ値・送料・販売手数料(10%)を踏まえ、目標粗利が確保できそうかで decision を決める
- 公開された確実な情報がほぼない無名ブランドは confidence="low" とし、decision は "慎重" もしくは "見送り" を推奨
- 推測の幅が広い場合は estimatedSaleMin と estimatedSaleMax を控えめに広く取る
- リスクは具体的に書く（例: "真贋判定が困難", "ニット類は虫食いで売価激減"）`;

type Payload = {
  brand: string;
  itemType: string;
  category?: string;
  size?: string;
  material?: string;
  condition?: string;
  purchasePrice: number;
  expectedShipping?: number;
  targetProfit: number;
  useTargetProfit: boolean;
};

function safeJSON<T = unknown>(s: string): T | null {
  try { return JSON.parse(s) as T; } catch { /* noop */ }
  const m = s.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]) as T; } catch { /* noop */ }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    if (!body || !body.brand) {
      return new Response(JSON.stringify({ error: "brand is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `# 商品情報
- ブランド: ${body.brand}
- カテゴリ: ${body.category ?? "-"}
- 服種類: ${body.itemType ?? "-"}
- サイズ: ${body.size ?? "-"}
- 素材: ${body.material ?? "-"}
- 状態: ${body.condition ?? "-"}
- 仕入れ値: ${body.purchasePrice}円
- 想定送料: ${body.expectedShipping ?? "未指定"}円
- 目標粗利: ${body.useTargetProfit ? `${body.targetProfit}円` : "AI判定に含めない（参考のみ）"}

# 状況
メルカリ・Yahoo!フリマの売り切れ検索が0件、本アプリのマスタールールも該当なし。
公開情報・一般的な中古相場感から、独自のAI参考判断を返してください。`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: `Gemini error: ${t}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = safeJSON<{
      estimatedSaleMin: number;
      estimatedSaleMax: number;
      decision: string;
      confidence: string;
      reasoning: string;
      sources: string[];
      risks: string[];
      recommendation: string;
    }>(text);

    if (!parsed) {
      return new Response(JSON.stringify({ error: "invalid AI response", raw: text }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
