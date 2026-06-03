-- Supabase starter schema for Sedori AI Judge.
-- Import the CSVs from sedori_ai_guideline_master_v4_supabase_csv.zip into matching tables if you want DB mode later.

create table if not exists brands (
  brand_id text primary key,
  brand_name text not null,
  brand_name_jp text,
  category_id text,
  created_at timestamptz default now()
);

create table if not exists brand_rules (
  rule_id text primary key,
  brand_id text references brands(brand_id),
  category_id text,
  category text,
  gender text,
  item_type text,
  target_item text,
  season text,
  priority text,
  buy_price_min integer,
  buy_price_max integer,
  sale_price_min integer,
  sale_price_max integer,
  shipping_min integer,
  shipping_max integer,
  brand_score integer,
  genre_score integer,
  material_score integer,
  size_score integer,
  turnover_score integer,
  authenticity_risk_score integer,
  condition_risk_score integer,
  market_confidence integer,
  initial_score integer,
  initial_decision text,
  strong_conditions text,
  avoid_conditions text,
  photo_required text,
  field_action text,
  ai_memo text,
  mercari_url_1 text,
  mercari_url_2 text,
  mercari_url_3 text,
  created_at timestamptz default now()
);

create table if not exists purchase_records (
  id uuid primary key default gen_random_uuid(),
  rule_id text references brand_rules(rule_id),
  purchased_at date,
  store_name text,
  brand_name text,
  item_type text,
  size_label text,
  material text,
  condition_note text,
  purchase_price integer,
  listing_price integer,
  sold_price integer,
  shipping_cost integer,
  platform_fee integer,
  actual_profit integer,
  days_to_sell integer,
  ai_decision text,
  user_decision text,
  result_status text,
  failure_reason text,
  created_at timestamptz default now()
);
