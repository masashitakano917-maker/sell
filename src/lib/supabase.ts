import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type PurchaseRecord = {
  id: string;
  user_id: string;
  brand: string;
  brand_jp: string;
  category: string;
  item_type: string;
  size: string;
  material: string;
  condition: string;
  purchase_price: number;
  expected_shipping: number | null;
  sold_comps_count: number;
  has_tag: boolean;
  has_damage: boolean;
  has_smell: boolean;
  authenticity_unclear: boolean;
  rule_id: string;
  ai_score: number;
  ai_decision: string;
  estimated_sale_min: number;
  estimated_sale_max: number;
  image_urls: string[];
  notes: string;
  status: 'purchased' | 'listed' | 'sold' | 'returned';
  sold_price: number | null;
  actual_shipping: number | null;
  fee: number | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
};
