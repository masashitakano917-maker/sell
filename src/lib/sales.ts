import { supabase, type PurchaseRecord } from './supabase';
import type { ProductInput } from '../types';
import type { SaleOverride } from './judge';

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, '');
}

export async function fetchSaleOverride(input: ProductInput): Promise<SaleOverride | null> {
  const { data, error } = await supabase
    .from('purchase_records')
    .select('sold_price, brand, item_type')
    .eq('status', 'sold')
    .not('sold_price', 'is', null);

  if (error || !data) return null;

  const b = norm(input.brand);
  const t = norm(input.itemType);

  const matched = (data as Pick<PurchaseRecord, 'sold_price' | 'brand' | 'item_type'>[])
    .filter((r) => {
      if (!r.sold_price) return false;
      const rb = norm(r.brand);
      const rt = norm(r.item_type);
      const brandMatch = b && (rb.includes(b) || b.includes(rb));
      const typeMatch = !t || rt.includes(t) || t.includes(rt);
      return brandMatch && typeMatch;
    })
    .map((r) => r.sold_price as number)
    .sort((a, b) => a - b);

  if (matched.length === 0) return null;

  const min = matched[0];
  const max = matched[matched.length - 1];
  const median = matched[Math.floor(matched.length / 2)];

  return {
    saleMin: matched.length >= 3 ? Math.round((min + median) / 2) : min,
    saleMax: matched.length >= 3 ? Math.round((max + median) / 2) : max,
    sampleCount: matched.length,
  };
}
