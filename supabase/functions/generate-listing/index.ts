import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `あなたはメルカリ・Yahoo!フリマでの中古衣料・バッグの出品文を作る編集者です。
日本語で、購入意欲を高めつつ虚偽の無い、検索ヒットしやすい文面を作ります。
出力は必ず以下のJSONスキーマだけ。前後にコードフェンスや説明は不要。

{
  "title": string,
  "description": string,
  "hashtags": string[],
  "priceTips": string[]
}

ルール:
- title は 40文字以内。フォーマット：「[ブランド] [服種類] [色/柄(あれば)] [サイズ] [素材(短く)] [状態(短く)]」。冗長な装飾語禁止。
- description は 4〜8行。改行は \\n。
  1行目：商品概要（ブランド・服種類・サイズ・色・素材）。
  2行目：状態の正直な記述（タグ有無・キズ汚れ・使用感）。あれば damageDetails を反映。
  3行目以降：着丈・袖丈などの実測値があれば箇条書き、無ければ素材感やシーン提案。
  最後に「即購入OK」「不明点はコメント下さい」など標準文。
- hashtags は 5〜10個。「#ブランド名」「#服種類」「#カラー」「#素材」「#サイズ」など、検索語として有効なものだけ。# を含む文字列で返す。
- priceTips は 1〜3個。値付け・回転・出品時の注意点（例：「春先までに売り切ると高値が付きやすい」「タグありなので新品同様で訴求」）。
- 真贋不明な場合は description に「自身で購入したものですが、真贋に関しては個人の判断でお願いします」を含める。
- ダメージ・臭いがある場合は description で必ず明記する（隠蔽禁止）。`;

type Payload = {
  brand?: string;
  brandJp?: string;
  itemType?: string;
  category?: string;
  size?: string;
  material?: string;
  condition?: string;
  hasTag?: boolean;
  hasDamage?: boolean;
  hasSmell?: boolean;
  authenticityUnclear?: boolean;
  damageDetails?: string;
  searchHints?: string[];
  estimatedSaleMin?: number;
  estimatedSaleMax?: number;
  masterTemplate?: string;
};

function fallbackListing(p: Payload) {
  const brand = (p.brandJp && p.brandJp.trim()) || (p.brand ?? '').trim();
  const titleParts = [
    brand,
    p.itemType ?? '',
    (p.searchHints ?? []).slice(0, 1).join(''),
    p.size ?? '',
    (p.material ?? '').slice(0, 10),
    p.condition ?? '',
  ].filter(Boolean);
  const title = titleParts.join(' ').slice(0, 40);

  const descLines: string[] = [];
  descLines.push(`${brand} の ${p.itemType ?? ''}${p.size ? `（サイズ ${p.size}）` : ''}${p.material ? ` ${p.material}` : ''}`.trim());
  if (p.hasTag) descLines.push('新品タグ付きの未使用品です。');
  else if (p.condition) descLines.push(`状態：${p.condition}`);
  if (p.hasDamage) {
    descLines.push(p.damageDetails ? `※ダメージあり：${p.damageDetails}` : '※ダメージあり：写真でご確認ください。');
  }
  if (p.hasSmell) descLines.push('※香水・タバコ等の匂いがある可能性があります。気になる方はお控えください。');
  if (p.authenticityUnclear) descLines.push('※自身で購入したものですが、真贋に関しては個人の判断でお願いします。');
  if ((p.searchHints ?? []).length > 0) descLines.push(`特徴：${p.searchHints!.join(' / ')}`);
  descLines.push('即購入OKです。気になる点はコメントよりご質問ください。');

  const hashtags = [
    brand && `#${brand.replace(/\s+/g, '')}`,
    p.itemType && `#${p.itemType}`,
    p.category && `#${p.category}`,
    p.size && `#サイズ${p.size}`,
    p.material && `#${p.material.split(/[\s/]+/)[0]}`,
    ...(p.searchHints ?? []).map((h) => `#${h}`),
  ].filter((s): s is string => !!s).slice(0, 8);

  const priceTips: string[] = [];
  if (p.estimatedSaleMin && p.estimatedSaleMax) {
    priceTips.push(`相場ベースの想定販売：${p.estimatedSaleMin.toLocaleString()}〜${p.estimatedSaleMax.toLocaleString()}円`);
  }
  if (p.hasTag) priceTips.push('タグありなので新品同様の価格帯で訴求できます。');

  return {
    title,
    description: descLines.join('\n'),
    hashtags,
    priceTips,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as Payload;
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ ...fallbackListing(payload), source: 'fallback' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userText = `次の商品情報から、メルカリ／Yahoo!フリマ向けの出品文をスキーマ通りに作ってください。

【商品情報】
- ブランド: ${payload.brandJp || payload.brand || '(不明)'}
- 服種類: ${payload.itemType ?? ''}
- カテゴリ: ${payload.category ?? ''}
- サイズ: ${payload.size ?? ''}
- 素材: ${payload.material ?? ''}
- 状態: ${payload.condition ?? ''}
- 新品タグ有無: ${payload.hasTag ? 'あり' : 'なし'}
- ダメージ: ${payload.hasDamage ? 'あり' : 'なし'}${payload.damageDetails ? `（${payload.damageDetails}）` : ''}
- 臭い: ${payload.hasSmell ? 'あり' : 'なし'}
- 真贋: ${payload.authenticityUnclear ? '不明（要明記）' : '本物として扱う'}
- 画像由来の特徴語: ${(payload.searchHints ?? []).join(' / ') || '(なし)'}
- 想定販売価格帯: ${payload.estimatedSaleMin ?? '?'}〜${payload.estimatedSaleMax ?? '?'} 円
${payload.masterTemplate ? `- マスター出品テンプレ: ${payload.masterTemplate}` : ''}`;

    const model = "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const aiRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0.4,
          response_mime_type: "application/json",
        },
      }),
    });

    if (!aiRes.ok) {
      return new Response(JSON.stringify({ ...fallbackListing(payload), source: 'fallback' }), {
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

    const out = {
      title: typeof parsed.title === 'string' ? parsed.title : fallbackListing(payload).title,
      description: typeof parsed.description === 'string' ? parsed.description : fallbackListing(payload).description,
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((s: unknown) => typeof s === 'string') : fallbackListing(payload).hashtags,
      priceTips: Array.isArray(parsed.priceTips) ? parsed.priceTips.filter((s: unknown) => typeof s === 'string') : fallbackListing(payload).priceTips,
      source: 'ai',
    };

    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
