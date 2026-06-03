import type { MasterRule } from '../types';

function norm(s: string | undefined): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, '');
}

export function findBestRule(rules: MasterRule[], brand: string, itemType: string, category: string): MasterRule | undefined {
  const b = norm(brand);
  const t = norm(itemType);
  const c = norm(category);

  const scored = rules.map((rule) => {
    const rb = norm(rule.ブランド);
    const rbjp = norm(rule.ブランド日本語);
    const rt = norm(rule.服種類 + ' ' + rule['商品名・狙い目']);
    const rc = norm(rule.カテゴリ);

    const brandMatch = !!b && (rb.includes(b) || b.includes(rb) || rbjp.includes(b) || b.includes(rbjp));
    const itemMatch = !!t && rt.includes(t);
    const categoryMatch = !!c && rc.includes(c);

    let score = 0;
    if (brandMatch) score += 60;
    if (itemMatch) score += 25;
    if (categoryMatch) score += 15;
    return { rule, score, brandMatch, itemMatch, categoryMatch };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (!top || top.score === 0) return undefined;

  if (b && t) {
    const exact = scored.find((s) => s.brandMatch && s.itemMatch);
    if (exact) return exact.rule;
    return undefined;
  }

  if (b && !t) {
    return top.brandMatch ? top.rule : undefined;
  }

  return top.rule;
}

export function filterRules(rules: MasterRule[], query: string): MasterRule[] {
  const q = norm(query);
  if (!q) return rules.slice(0, 50);
  return rules.filter((r) => norm([
    r.ブランド,
    r.ブランド日本語,
    r.カテゴリ,
    r.服種類,
    r['商品名・狙い目'],
    r.検索キーワード,
  ].join(' ')).includes(q)).slice(0, 100);
}

export type BrandCoverage = {
  brandLabel: string;
  hasItemTypeMatch: boolean;
  availableItemTypes: Array<{ itemType: string; priority: string; aim: string }>;
};

export function getBrandCoverage(
  rules: MasterRule[],
  brand: string,
  itemType: string,
): BrandCoverage | undefined {
  const b = norm(brand);
  if (!b) return undefined;
  const t = norm(itemType);

  const brandRules = rules.filter((r) => {
    const rb = norm(r.ブランド);
    const rbjp = norm(r.ブランド日本語);
    return rb.includes(b) || b.includes(rb) || rbjp.includes(b) || b.includes(rbjp);
  });
  if (brandRules.length === 0) return undefined;

  const seen = new Map<string, { itemType: string; priority: string; aim: string }>();
  for (const r of brandRules) {
    if (!r.服種類) continue;
    const key = r.服種類;
    if (!seen.has(key)) {
      seen.set(key, {
        itemType: r.服種類,
        priority: r.優先度 ?? '',
        aim: r['商品名・狙い目'] ?? '',
      });
    }
  }

  const hasItemTypeMatch = !!t && brandRules.some((r) => norm(r.服種類 + ' ' + r['商品名・狙い目']).includes(t));
  const sample = brandRules[0];
  const brandLabel = sample.ブランド日本語 || sample.ブランド;

  return {
    brandLabel,
    hasItemTypeMatch,
    availableItemTypes: Array.from(seen.values()),
  };
}
