import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const SYSTEM_PROMPT = `あなたは中古品鑑定のエキスパートです。
最初に提示される画像は「リファレンス（仕入れ予定品）」です。
続いて C1, C2, ... と番号付きで「候補商品」の画像が提示されます。
各候補について、リファレンスと同一商品か判定してください。

判定レベル:
- "same": 同じブランドかつ同じ商品（型番・色・柄が同じ。サイズや状態の差は許容）
- "similar": 同じカテゴリ／系統だが、別商品の可能性が高い（色違い・別シーズン・別シリーズ等）
- "different": 明らかに別物（カテゴリやデザインが大きく異なる）
- "unknown": 画像が小さい／不鮮明等で判定できない

必ず以下のJSONのみを返してください:
{
  "matches": [
    { "id": "C1", "level": "same"|"similar"|"different"|"unknown", "reason": "..." },
    ...
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

    const { reference, candidates } = (await req.json()) as { reference: string[]; candidates: Candidate[] };
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

    const limited = candidates.slice(0, 16);
    const fetched = await Promise.all(
      limited.map(async (c) => {
        if (!c.thumbnail) return { c, img: null };
        const img = await fetchImageBase64(c.thumbnail);
        return { c, img };
      }),
    );

    const parts: Array<Record<string, unknown>> = [
      { text: "リファレンス画像（仕入れ予定品）です:" },
      ...refImages.map((r) => ({ inline_data: { mime_type: r.mime, data: r.data } })),
    ];

    const usableCandidates: Candidate[] = [];
    fetched.forEach(({ c, img }, i) => {
      if (!img) return;
      const label = `C${i + 1}`;
      usableCandidates.push({ ...c, id: label });
      parts.push({ text: `候補 ${label} (${c.title ?? ""}):` });
      parts.push({ inline_data: { mime_type: img.mime, data: img.data } });
    });

    if (usableCandidates.length === 0) {
      return new Response(
        JSON.stringify({ matches: [], note: "候補画像を取得できませんでした" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    parts.push({
      text: "上記すべての候補について、リファレンスと同一商品かJSONで判定してください。idは C1, C2 のラベルを使用。",
    });

    const model = "gemini-2.0-flash";
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
