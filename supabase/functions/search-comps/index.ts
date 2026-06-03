import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type CompItem = { id: string; title: string; price: number; url: string; thumbnail?: string };
type CompResult = { count: number; items: CompItem[]; average: number; searchUrl: string; error?: string };

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round(sum / nums.length);
}

function extractNextData(html: string): unknown | null {
  const m = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function deepFindArray(node: unknown, predicate: (item: any) => boolean, found: any[][] = []): any[][] {
  if (!node || typeof node !== "object") return found;
  if (Array.isArray(node)) {
    if (node.length > 0 && node.every(predicate)) found.push(node);
    for (const v of node) deepFindArray(v, predicate, found);
  } else {
    for (const v of Object.values(node as Record<string, unknown>)) deepFindArray(v, predicate, found);
  }
  return found;
}

async function searchMercari(keyword: string): Promise<CompResult> {
  const params = new URLSearchParams({
    keyword,
    status: "sold_out",
    sort: "created_time",
    order: "desc",
  });
  const searchUrl = `https://jp.mercari.com/search?${params.toString()}`;
  try {
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ja-JP,ja;q=0.9",
      },
    });
    if (!res.ok) return { count: 0, items: [], average: 0, searchUrl, error: `Mercari ${res.status}` };
    const html = await res.text();

    const items: CompItem[] = [];

    const nextData = extractNextData(html);
    if (nextData) {
      const candidates = deepFindArray(nextData, (it) =>
        it && typeof it === "object" && typeof it.id === "string" &&
        (typeof it.price === "number" || typeof it.price === "string") &&
        (typeof it.name === "string" || typeof it.title === "string"),
      );
      for (const arr of candidates) {
        for (const it of arr) {
          const id = String(it.id);
          if (!/^m\d+$/.test(id) && !/^\d+$/.test(id)) continue;
          const price = typeof it.price === "number" ? it.price : parseInt(String(it.price), 10);
          if (!Number.isFinite(price) || price <= 0) continue;
          const itemId = id.startsWith("m") ? id : "m" + id;
          const thumb = typeof it.thumbnails?.[0] === "string" ? it.thumbnails[0] : `https://static.mercdn.net/c!/w=240/thumb/photos/${itemId}_1.jpg`;
          items.push({
            id: itemId,
            title: String(it.name ?? it.title ?? ""),
            price,
            url: `https://jp.mercari.com/item/${itemId}`,
            thumbnail: thumb,
          });
        }
        if (items.length > 0) break;
      }
    }

    if (items.length === 0) {
      const re = /\/item\/(m\d+)[^"]*"[^>]*>[\s\S]{0,400}?¥\s*([\d,]+)/g;
      let m;
      const seen = new Set<string>();
      while ((m = re.exec(html)) !== null && items.length < 30) {
        const id = m[1];
        if (seen.has(id)) continue;
        seen.add(id);
        const price = parseInt(m[2].replace(/,/g, ""), 10);
        if (!Number.isFinite(price)) continue;
        items.push({
          id,
          title: "",
          price,
          url: `https://jp.mercari.com/item/${id}`,
          thumbnail: `https://static.mercdn.net/c!/w=240/thumb/photos/${id}_1.jpg`,
        });
      }
    }

    const top = items.slice(0, 20);
    return {
      count: items.length,
      items: top,
      average: average(top.map((i) => i.price)),
      searchUrl,
    };
  } catch (e) {
    return { count: 0, items: [], average: 0, searchUrl, error: (e as Error).message };
  }
}

async function searchPayPayFlea(keyword: string): Promise<CompResult> {
  const searchUrl = `https://paypayfleamarket.yahoo.co.jp/search/${encodeURIComponent(keyword)}?closed=1&sort=ranking`;
  try {
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ja-JP,ja;q=0.9",
      },
    });
    if (!res.ok) return { count: 0, items: [], average: 0, searchUrl, error: `PayPayFlea ${res.status}` };
    const html = await res.text();

    const items: CompItem[] = [];

    const nextData = extractNextData(html);
    if (nextData) {
      const candidates = deepFindArray(nextData, (it) =>
        it && typeof it === "object" && typeof it.id === "string" &&
        (typeof it.price === "number" || typeof it.price === "string") &&
        (typeof it.name === "string" || typeof it.title === "string"),
      );
      for (const arr of candidates) {
        for (const it of arr) {
          const id = String(it.id);
          const price = typeof it.price === "number" ? it.price : parseInt(String(it.price), 10);
          if (!Number.isFinite(price) || price <= 0) continue;
          items.push({
            id,
            title: String(it.name ?? it.title ?? ""),
            price,
            url: `https://paypayfleamarket.yahoo.co.jp/item/${id}`,
            thumbnail: typeof it.thumbnailImageUrl === "string" ? it.thumbnailImageUrl : undefined,
          });
        }
        if (items.length > 0) break;
      }
    }

    if (items.length === 0) {
      const re = /\/item\/([a-zA-Z0-9_-]+)[^"]*"[^>]*>[\s\S]{0,500}?¥\s*([\d,]+)/g;
      let m;
      const seen = new Set<string>();
      while ((m = re.exec(html)) !== null && items.length < 30) {
        const id = m[1];
        if (seen.has(id)) continue;
        seen.add(id);
        const price = parseInt(m[2].replace(/,/g, ""), 10);
        if (!Number.isFinite(price)) continue;
        items.push({ id, title: "", price, url: `https://paypayfleamarket.yahoo.co.jp/item/${id}` });
      }
    }

    const top = items.slice(0, 20);
    return {
      count: items.length,
      items: top,
      average: average(top.map((i) => i.price)),
      searchUrl,
    };
  } catch (e) {
    return { count: 0, items: [], average: 0, searchUrl, error: (e as Error).message };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { keyword } = (await req.json()) as { keyword: string };
    if (!keyword || typeof keyword !== "string") {
      return new Response(JSON.stringify({ error: "keyword required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmed = keyword.trim();
    const [mercari, paypay] = await Promise.all([
      searchMercari(trimmed),
      searchPayPayFlea(trimmed),
    ]);

    const allPrices = [...mercari.items.map((i) => i.price), ...paypay.items.map((i) => i.price)];
    const overall = {
      count: mercari.count + paypay.count,
      average: average(allPrices),
    };

    return new Response(JSON.stringify({ keyword: trimmed, mercari, paypay, overall }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
