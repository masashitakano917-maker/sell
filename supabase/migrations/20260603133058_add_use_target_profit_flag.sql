/*
  # 目標粗利をAI判定に含めるかどうかの設定追加

  1. 変更
    - `user_settings` テーブルに `use_target_profit` (boolean) カラムを追加。
      - デフォルト `true`（目標粗利をAI判定に含める）。
      - `false` の場合、AI判定は仕入れる/見送るの加点・減点計算で目標粗利を考慮しません。

  2. 安全性
    - `IF NOT EXISTS` 相当のチェックで重複追加を防止。
    - 既存行は default の `true` が適用され、後方互換を維持。
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'use_target_profit'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN use_target_profit boolean NOT NULL DEFAULT true;
  END IF;
END $$;