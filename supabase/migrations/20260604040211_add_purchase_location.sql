/*
  # 仕入れ場所カラムを追加

  1. 変更内容
    - `purchase_records` テーブルに `purchase_location` (text) を追加
      - 仕入れ店舗・場所（例：「セカスト渋谷店」「2nd STREET 新宿」）
      - 店舗別の収益分析・的中率算出に使用
      - DEFAULT '' で既存レコードを安全にバックフィル
  2. セキュリティ
    - 既存の RLS ポリシーをそのまま継承
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_records' AND column_name = 'purchase_location'
  ) THEN
    ALTER TABLE purchase_records ADD COLUMN purchase_location text DEFAULT '' NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchase_records_location ON purchase_records (purchase_location);
