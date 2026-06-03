import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const SYSTEM_PROMPT = `あなたは中古アパレル・バッグの目利きで、せどり仕入れの相場照合を担当します。
最初に「リファレンス（仕入れ予定品）」の画像が提示されます。続いて C1, C2, ... と番号付きで「候補商品」の画像（メルカリ／Yahoo!フリマの売り切れ商品サムネイル）が提示されます。

# 重要な判定基準（必読）
あなたは品番や個体識別ではなく、**せどり相場の参考にできる程度に同じ商品か** を判定します。
サムネイル画像は小さく、撮影環境（照明・背景・角度・トルソー有無）はバラバラです。これらの差は同一性判定に**使ってはいけません**。

判定レベル:
- "same": 以下のいずれかに該当する。
  - 同じブランドの同じデザイン／同じプリント柄／同じコラボ商品（例：「agnes b. × IKON コラボの星座プリントワンピース」のように、特徴的な柄・刺繍・ロゴ配置・コラボ等が一致）
  - サイズ違い・色違いでも、明らかに同じシリーズ／同型番の派生
  - サイズ表記、撮影アングル、背景、トルソー使用の差は無視して同一とみなす
- "similar": 同じブランド／カテゴリだが別商品（柄違い／シーズン違い／別シリーズ）
- "different": 明らかに別物（カテゴリやデザインが大きく異なる、別ブランド）
- "unknown": サムネイルが極端に不鮮明・画像が文字だけ等で柄やシルエットを確認できない

# 判定の手順
1. リファレンスの「特徴的な要素」を抽出する（例：星座柄、特定のロゴ、特徴的な切り替え、コラボ表示、独特の素材感）。
2. 各候補について、その特徴的な要素が見えるかを最優先で確認する。
3. 候補画像が複数枚並んでいる場合、どれか1枚にでも特徴が一致すれば "same" としてよい。
4. **迷ったら "same" を選ぶ**。せどりの相場照合は「明確に違う」と言える時だけ "different" にする。
5. タイトル文字列にコラボ名・型番・特徴的なキーワードがあれば、それも判定材料に使う。

必ず以下のJSONのみを返す:
{
  "matches": [
    { "id": "C1", "level": "same"|"similar"|"different"|"unknown", "reason": "簡潔な根拠（30〜60字）" }
  ]
}`;

type Candidate = { id: string; thumbnail?: string; title?: string };

function parseDataUrl(s: string): { mime: string; data: string } | null {
  const m = s.match(/^data:([^;,]+);base64,(.*)$/);
  if (!m) return null;
  return { mime: m[1], data: m[2] };
}

async function fetchImageBase64(url: string): Promise<{ mime: string; data: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Referer": "https://jp.mercari.com/",
      },
    });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!mime.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 4_000_000) return null;
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return { mime, data: btoa(bin) };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { reference, candidates, context } = (await req.json()) as { reference: string[]; candidates: Candidate[]; context?: { brand?: string; itemType?: string; keyword?: string } };
    if (!Array.isArray(reference) || reference.length === 0) {
      return new Response(JSON.stringify({ error: "reference required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const refImages = reference
      .slice(0, 3)
      .map(parseDataUrl)
      .filter((x): x is { mime: string; data: string } => x !== null);
    if (refImages.length === 0) {
      return new Response(JSON.stringify({ error: "invalid reference images" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limited = candidates.slice(0, 24);
    const fetched = await Promise.all(
      limited.map(async (c) => {
        if (!c.thumbnail) return { c, img: null };
        const img = await fetchImageBase64(c.thumbnail);
        return { c, img };
      }),
    );

    const parts: Array<Record<string, unknown>> = [];
    if (context && (context.brand || context.itemType || context.keyword)) {
      parts.push({
        text: `# 検索コンテキスト
ブランド: ${context.brand ?? "-"}
服種類: ${context.itemType ?? "-"}
検索キーワード: ${context.keyword ?? "-"}
このブランド／カテゴリの相場照合を行います。`,
      });
    }
    parts.push({ text: "# リファレンス画像（仕入れ予定品）" });
    refImages.forEach((r) => parts.push({ inline_data: { mime_type: r.mime, data: r.data } }));

    const usableCandidates: Candidate[] = [];
    fetched.forEach(({ c, img }, i) => {
      if (!img) return;
      const label = `C${i + 1}`;
      usableCandidates.push({ ...c, id: label });
      parts.push({ text: `# 候補 ${label}\nタイトル: ${c.title ?? "-"}` });
      parts.push({ inline_data: { mime_type: img.mime, data: img.data } });
    });

    if (usableCandidates.length === 0) {
      return new Response(
        JSON.stringify({ matches: [], note: "候補画像を取得できませんでした" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    parts.push({
      text: `# 指示
上記すべての候補について、リファレンスと同一商品か JSON で判定してください。idは C1, C2 のラベルを使用。
- プリント柄・コラボ・特徴的なロゴ／装飾が一致したら "same"。
- 撮影アングル、背景、トルソー、サイズ、色みの差は同一性判定に使わない。
- 迷ったら "different" ではなく "same" または "similar" を選ぶ。`,
    });

    const model = "gemini-3-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const aiRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.1, response_mime_type: "application/json" },
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
    let parsed: { matches?: Array<{ id: string; level: string; reason?: string }> } = {};
    try { parsed = JSON.parse(text); } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* noop */ } }
    }

    const idMap = new Map<string, Candidate>();
    fetched.forEach(({ c }, i) => {
      idMap.set(`C${i + 1}`, c);
    });

    const matches = (parsed.matches ?? []).map((m) => {
      const original = idMap.get(m.id);
      return {
        id: m.id,
        candidateId: original?.id,
        level: m.level,
        reason: m.reason ?? "",
      };
    });

    return new Response(JSON.stringify({ matches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
