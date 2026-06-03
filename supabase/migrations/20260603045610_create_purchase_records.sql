/*
  # 仕入れ記録テーブル

  1. New Tables
    - `purchase_records` - 仕入れた商品の記録
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `brand` (text) - ブランド英字
      - `brand_jp` (text) - ブランド日本語
      - `category` (text) - カテゴリ
      - `item_type` (text) - 服種類
      - `size` (text) - サイズ
      - `material` (text) - 素材
      - `condition` (text) - 状態
      - `purchase_price` (integer) - 仕入れ値
      - `expected_shipping` (integer) - 想定送料
      - `sold_comps_count` (integer) - 売り切れ相場件数
      - `has_tag` (boolean) - 新品タグ付き
      - `has_damage` (boolean) - ダメージあり
      - `has_smell` (boolean) - 臭いあり
      - `authenticity_unclear` (boolean) - 真贋不明
      - `rule_id` (text) - 一致したマスターID
      - `ai_score` (integer) - AI判定スコア
      - `ai_decision` (text) - AI判定結果
      - `estimated_sale_min` (integer) - 想定販売価格下限
      - `estimated_sale_max` (integer) - 想定販売価格上限
      - `image_urls` (text[]) - アップロード画像URL
      - `notes` (text) - メモ
      - `status` (text) - ステータス: purchased / listed / sold / returned
      - `sold_price` (integer) - 実販売価格
      - `actual_shipping` (integer) - 実送料
      - `fee` (integer) - 手数料
      - `sold_at` (timestamptz) - 売却日時
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `purchase_records`
    - Policies: ユーザーは自分のレコードのみ参照・追加・更新・削除可能

  3. Indexes
    - user_id, brand, item_type で複合インデックス（実売データ集計用）
*/

CREATE TABLE IF NOT EXISTS purchase_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand text DEFAULT '',
  brand_jp text DEFAULT '',
  category text DEFAULT '',
  item_type text DEFAULT '',
  size text DEFAULT '',
  material text DEFAULT '',
  condition text DEFAULT '',
  purchase_price integer DEFAULT 0,
  expected_shipping integer,
  sold_comps_count integer DEFAULT 0,
  has_tag boolean DEFAULT false,
  has_damage boolean DEFAULT false,
  has_smell boolean DEFAULT false,
  authenticity_unclear boolean DEFAULT false,
  rule_id text DEFAULT '',
  ai_score integer DEFAULT 0,
  ai_decision text DEFAULT '',
  estimated_sale_min integer DEFAULT 0,
  estimated_sale_max integer DEFAULT 0,
  image_urls text[] DEFAULT '{}',
  notes text DEFAULT '',
  status text DEFAULT 'purchased',
  sold_price integer,
  actual_shipping integer,
  fee integer,
  sold_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_records_user ON purchase_records(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_records_brand_item ON purchase_records(user_id, brand, item_type);
CREATE INDEX IF NOT EXISTS idx_purchase_records_status ON purchase_records(user_id, status);

ALTER TABLE purchase_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchase records"
  ON purchase_records FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchase records"
  ON purchase_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own purchase records"
  ON purchase_records FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own purchase records"
  ON purchase_records FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
